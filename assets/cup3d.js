/*
 * Starlaban Coffee: 3D clear iced-coffee cup. You see the layered coffee and milk inside,
 * with the logo poured in milk in the middle, ice cubes, a straw and a clear dome lid.
 * Needs three.min.js (r149, global THREE) loaded first.
 *
 *   var cup = StarlabanCup.mount(document.getElementById('cup'), {
 *     milkSrc: 'assets/logo-milk.png',   // the logo in milk-white on a transparent background
 *     fallbackSrc: 'assets/logo.png'     // plain image if WebGL is missing
 *   });
 *   cup.burst();    // quick celebratory spin
 *   cup.replay();   // play the drop-in again
 *   cup.destroy();
 *
 * Load-in: the cup drops and bounces, then the lid lands on the rim.
 * Idle: spins by itself (no dragging; touches pass through so the page scrolls).
 * Pauses off screen / hidden tab; a still frame for prefers-reduced-motion.
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var CUP_H = 2.35, R_BOT = 0.70, R_TOP = 0.98;
  var FILL = 2.05;           // liquid surface height
  var WALL = 0.05;           // gap between glass and liquid
  var AUTO = 0.9;            // idle spin, radians per second
  function radiusAt(y) { return R_BOT + (R_TOP - R_BOT) * (y / CUP_H); }
  function liquidR(y) { return radiusAt(y) - WALL; }

  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(global.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeOutCubic(p) { return 1 - Math.pow(1 - p, 3); }
  // Bounces but never goes past 1, so nothing can sink into the cup.
  function easeOutBounce(p) {
    var n = 7.5625, d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) { p -= 1.5 / d; return n * p * p + 0.75; }
    if (p < 2.5 / d) { p -= 2.25 / d; return n * p * p + 0.9375; }
    p -= 2.625 / d; return n * p * p + 0.984375;
  }
  function lathe(pts, seg, a, b) {
    return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg, a, b);
  }
  function radialTexture(stops) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // Coffee layers painted on a canvas: milk at the bottom, caramel, then dark coffee, with milk swirls.
  function liquidTexture() {
    var W = 256, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, H, 0, 0); // bottom -> top
    g.addColorStop(0.00, '#f7e6cb'); g.addColorStop(0.16, '#f1dcbc');
    g.addColorStop(0.34, '#b9824f'); g.addColorStop(0.50, '#6a3a1b');
    g.addColorStop(0.62, '#3a1d0d'); g.addColorStop(1.00, '#2b150a');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.lineCap = 'round';
    for (var i = 0; i < 16; i++) { // milk wisps rising into the coffee
      var sx = (i + Math.random() * 0.6) / 16 * W, y0 = H * (0.52 + Math.random() * 0.3);
      x.strokeStyle = 'rgba(255,238,214,' + (0.16 + Math.random() * 0.2).toFixed(2) + ')';
      x.lineWidth = 4 + Math.random() * 9;
      x.beginPath(); x.moveTo(sx, y0);
      x.bezierCurveTo(sx + 26, y0 - 40, sx - 30, y0 - 80, sx + 14, y0 - 120 - Math.random() * 60);
      x.stroke();
    }
    var t = new THREE.CanvasTexture(c); return t;
  }
  function surfaceTexture() {
    var S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    var x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
    g.addColorStop(0, '#3a1d0d'); g.addColorStop(0.8, '#2f170a'); g.addColorStop(1, '#4a2a14');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.lineCap = 'round'; x.strokeStyle = 'rgba(255,238,214,0.55)';
    for (var k = 0; k < 3; k++) { // a little milk spiral
      x.lineWidth = 10 - k * 2.5; x.beginPath();
      for (var a = 0; a < 9; a += 0.2) {
        var r = 8 + a * (8 - k * 1.2), px = S / 2 + Math.cos(a + k * 2) * r, py = S / 2 + Math.sin(a + k * 2) * r;
        if (a === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    }
    return new THREE.CanvasTexture(c);
  }

  function showFallback(el, src) {
    el.classList.add('cup3d-fallback');
    if (src && !el.querySelector('img')) {
      var img = document.createElement('img');
      img.src = src; img.alt = 'Starlaban Coffee logo';
      img.style.cssText = 'max-width:100%;max-height:100%;border-radius:50%';
      el.appendChild(img);
    }
  }
  var NOOP = { ok: false, burst: function () {}, replay: function () {}, destroy: function () {} };

  function mount(el, opts) {
    opts = opts || {};
    if (!el) return null;
    if (typeof THREE === 'undefined' || !hasWebGL()) { showFallback(el, opts.fallbackSrc); return NOOP; }

    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch (e) { showFallback(el, opts.fallbackSrc); return NOOP; }
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    var canvas = renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';
    canvas.setAttribute('aria-hidden', 'true');
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(canvas);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    camera.position.set(0, 2.7, 8.8);
    camera.lookAt(0, 1.75, 0);

    scene.add(new THREE.HemisphereLight(0xfff1de, 0x3a2418, 0.85));
    var key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(3, 5, 5); scene.add(key);
    var rim = new THREE.DirectionalLight(0xffd9a8, 0.9); rim.position.set(-4, 2, -3); scene.add(rim);

    var disposables = [];
    function keep(o) { disposables.push(o); return o; }

    var cupGroup = new THREE.Group(), root = new THREE.Group();
    root.add(cupGroup); scene.add(root);

    // ---- the coffee ----
    var liqTex = keep(liquidTexture()), topTex = keep(surfaceTexture());
    var liqMat = keep(new THREE.MeshStandardMaterial({ map: liqTex, roughness: 0.32, metalness: 0.02 }));
    var lp = [], steps = 14;
    for (var i = 0; i <= steps; i++) { var yy = 0.06 + (FILL - 0.06) * i / steps; lp.push([liquidR(yy), yy]); }
    var liqGeo = keep(lathe(lp, 64));
    cupGroup.add(new THREE.Mesh(liqGeo, liqMat));
    var topGeo = keep(new THREE.CircleGeometry(liquidR(FILL), 48));
    var top = new THREE.Mesh(topGeo, keep(new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.25 })));
    top.rotation.x = -Math.PI / 2; top.position.y = FILL;
    cupGroup.add(top);

    // the logo, poured in milk, sitting on the front and the back of the coffee
    var milkMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, transparent: true, alphaTest: 0.03 }));
    var MY0 = 0.82, MY1 = 1.9, mp = [];
    for (var j = 0; j <= 8; j++) { var my = MY0 + (MY1 - MY0) * j / 8; mp.push([liquidR(my) + 0.004, my]); }
    var arc = (MY1 - MY0) / liquidR((MY0 + MY1) / 2);
    var milkGeo = keep(lathe(mp, 40, -arc / 2, arc));
    var milk = new THREE.Mesh(milkGeo, milkMat), milkBack = new THREE.Mesh(milkGeo, milkMat);
    milkBack.rotation.y = Math.PI;
    milk.visible = milkBack.visible = false;
    cupGroup.add(milk, milkBack);

    // ice cubes bobbing at the surface
    var iceMat = keep(new THREE.MeshPhongMaterial({ color: 0xe4f7ff, specular: 0xffffff, shininess: 120, transparent: true, opacity: 0.55, depthWrite: false }));
    var iceGeo = keep(new THREE.BoxGeometry(0.4, 0.4, 0.4));
    var ice = [[-0.38, 0.12, 0.3, 0.4], [0.3, 0.1, -0.25, 1.4], [0.05, 0.14, 0.52, 2.4]].map(function (p, k) {
      var m = new THREE.Mesh(iceGeo, iceMat); m.userData = { x: p[0], y: FILL + p[1], z: p[2], ph: p[3] };
      m.rotation.set(0.5 + k, 0.7 * k, 0.3); m.renderOrder = 2; cupGroup.add(m); return m;
    });

    // ---- clear plastic cup ----
    var glassMat = keep(new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0xffffff, shininess: 160, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    var glassGeo = keep(lathe([[R_BOT - 0.04, 0], [R_BOT, 0.03], [R_TOP, CUP_H], [R_TOP + 0.03, CUP_H + 0.05]], 64));
    var glass = new THREE.Mesh(glassGeo, glassMat); glass.renderOrder = 3; cupGroup.add(glass);

    // ---- lid: clear dome with a straw; its own group so it drops onto the rim without passing through ----
    var lidGroup = new THREE.Group();
    var domeMat = keep(new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0xffffff, shininess: 180, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
    var domeGeo = keep(lathe([[1.06, 2.33], [1.09, 2.37], [1.09, 2.43], [1.02, 2.47], [0.98, 2.53],
      [0.9, 2.75], [0.7, 2.98], [0.4, 3.13], [0.0, 3.18]], 64));
    var dome = new THREE.Mesh(domeGeo, domeMat); dome.renderOrder = 4; lidGroup.add(dome);
    var strawMat = keep(new THREE.MeshStandardMaterial({ color: 0x1b0e07, roughness: 0.3, metalness: 0.1 }));
    var strawGeo = keep(new THREE.CylinderGeometry(0.055, 0.055, 3.3, 14));
    var straw = new THREE.Mesh(strawGeo, strawMat);
    straw.position.set(0.12, 1.8, -0.05); straw.rotation.z = -0.08;
    lidGroup.add(straw);
    cupGroup.add(lidGroup);

    var shadowTex = keep(radialTexture([[0, 'rgba(0,0,0,0.5)'], [0.6, 'rgba(0,0,0,0.2)'], [1, 'rgba(0,0,0,0)']]));
    var shadowMat = keep(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    var shadowGeo = keep(new THREE.PlaneGeometry(3.4, 3.4));
    var shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01;
    root.add(shadow);

    var started = false, T = 0;
    function begin() { if (!started) { started = true; update(); } }
    new THREE.TextureLoader().load(opts.milkSrc || '', function (tex) {
      tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      milkMat.map = tex; milkMat.needsUpdate = true; milk.visible = milkBack.visible = true; keep(tex);
      if (reduce) draw();
      begin();
    }, undefined, function () { begin(); });
    setTimeout(begin, 1500);

    var rotY = 0, boost = 0, bob = 0;
    var running = false, visible = true, raf = 0, last = 0, destroyed = false;

    var LID_LAND = 1.0, LID_DUR = 0.5;
    function pose() {
      var pc = easeOutBounce(clamp01((T - 0.1) / 0.85));
      var pl = easeOutBounce(clamp01((T - LID_LAND) / LID_DUR));
      var spin = (1 - easeOutCubic(clamp01((T - 0.1) / 1.1))) * TAU * 1.5;
      cupGroup.position.y = 4.4 * (1 - pc);
      lidGroup.position.y = 2.6 * (1 - pl);
      var sq = T > 0.95 && T < 1.25 ? Math.sin((T - 0.95) / 0.3 * Math.PI) * 0.04 : 0;
      cupGroup.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
      shadowMat.opacity = clamp01((T - 0.1) / 0.9);
      var ss = 0.55 + 0.45 * pc; shadow.scale.set(ss, ss, ss);
      cupGroup.rotation.y = rotY + spin;
      for (var k = 0; k < ice.length; k++) {
        var u = ice[k].userData;
        ice[k].position.set(u.x, u.y + Math.sin(bob * 1.3 + u.ph) * 0.03, u.z);
        ice[k].rotation.y += 0.002; ice[k].rotation.x += 0.0015;
      }
    }
    function size() {
      var w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 0.8 ? 34 : 30;
      camera.updateProjectionMatrix();
      draw();
    }
    function draw() { pose(); renderer.render(scene, camera); }

    function frame(now) {
      raf = 0;
      if (!running || destroyed) return;
      var dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
      if (started) T += dt;
      bob += dt;
      rotY += (AUTO + boost) * dt;
      boost *= Math.pow(0.05, dt); if (boost < 0.02) boost = 0;
      draw();
      raf = requestAnimationFrame(frame);
    }
    function update() {
      var should = started && visible && !document.hidden && !reduce;
      if (should && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
      else if (!should && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    }

    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); running = false; showFallback(el, opts.fallbackSrc); });

    var io = null, ro = null;
    if ('IntersectionObserver' in global) {
      io = new IntersectionObserver(function (en) { visible = en[0].isIntersecting; update(); });
      io.observe(el);
    }
    if ('ResizeObserver' in global) { ro = new ResizeObserver(size); ro.observe(el); }
    else global.addEventListener('resize', size);
    document.addEventListener('visibilitychange', update);

    if (reduce) { T = 99; rotY = -0.2; }
    size(); update();

    return {
      ok: true,
      burst: function () { if (reduce) { rotY += Math.PI; draw(); } else { boost = 14; } },
      replay: function () { if (reduce) return; T = 0; rotY = 0; boost = 0; update(); },
      destroy: function () {
        destroyed = true; running = false;
        if (raf) cancelAnimationFrame(raf);
        if (io) io.disconnect(); if (ro) ro.disconnect();
        document.removeEventListener('visibilitychange', update);
        disposables.forEach(function (o) { if (o && o.dispose) o.dispose(); });
        renderer.dispose();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  global.StarlabanCup = { mount: mount };
})(window);
