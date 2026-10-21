/*
 * Starlaban Coffee: 3D takeaway cup with the logo on its sleeve.
 * Needs three.min.js (r149, global THREE) loaded first.
 *
 *   var cup = StarlabanCup.mount(document.getElementById('cup'), {
 *     logoSrc: 'assets/logo.png',       // texture on the sleeve
 *     fallbackSrc: 'assets/logo.png'    // plain image if WebGL is missing
 *   });
 *   cup.burst();    // quick celebratory spin
 *   cup.replay();   // play the drop-in again
 *   cup.destroy();
 *
 * Load-in: the cup drops and bounces, then the lid lands on top.
 * Idle: spins by itself (no dragging; touches pass through so the page scrolls).
 * Pauses off screen / hidden tab; a still frame for prefers-reduced-motion.
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var CUP_H = 2.35, R_BOT = 0.70, R_TOP = 0.98;
  var AUTO = 0.9; // idle spin, radians per second
  function radiusAt(y) { return R_BOT + (R_TOP - R_BOT) * (y / CUP_H); }

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
    camera.position.set(0, 2.4, 8.6);
    camera.lookAt(0, 1.45, 0);

    scene.add(new THREE.HemisphereLight(0xfff1de, 0x2a160c, 0.8));
    var key = new THREE.DirectionalLight(0xfff0dc, 1.0); key.position.set(3, 5, 5); scene.add(key);
    var rim = new THREE.DirectionalLight(0xc4955a, 0.8); rim.position.set(-4, 2, -3); scene.add(rim);

    var disposables = [];
    function keep(o) { disposables.push(o); return o; }

    var paper = keep(new THREE.MeshStandardMaterial({ color: 0xf3e3cf, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }));
    var sleeveMat = keep(new THREE.MeshStandardMaterial({ color: 0x3a2113, roughness: 0.75, metalness: 0, side: THREE.DoubleSide }));
    var lidMat = keep(new THREE.MeshStandardMaterial({ color: 0x2e1a0f, roughness: 0.4, metalness: 0.08, side: THREE.DoubleSide }));
    var logoMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, transparent: true, alphaTest: 0.02 }));

    var cupGroup = new THREE.Group();
    var root = new THREE.Group();
    root.add(cupGroup);
    scene.add(root);

    var bodyGeo = keep(lathe([[0, 0], [R_BOT - 0.04, 0], [R_BOT, 0.05], [R_TOP, CUP_H], [R_TOP + 0.03, CUP_H + 0.05]], 56));
    cupGroup.add(new THREE.Mesh(bodyGeo, paper));

    var SY0 = 0.55, SY1 = 1.95, sp = [];
    for (var i = 0; i <= 8; i++) { var y = SY0 + (SY1 - SY0) * i / 8; sp.push([radiusAt(y) + 0.02, y]); }
    var sleeveGeo = keep(lathe(sp, 56));
    cupGroup.add(new THREE.Mesh(sleeveGeo, sleeveMat));

    var LY0 = 0.7, LY1 = 1.8, lp = [];
    for (var j = 0; j <= 6; j++) { var ly = LY0 + (LY1 - LY0) * j / 6; lp.push([radiusAt(ly) + 0.035, ly]); }
    var arc = (LY1 - LY0) / radiusAt((LY0 + LY1) / 2);
    var patchGeo = keep(lathe(lp, 32, -arc / 2, arc));
    var patch = new THREE.Mesh(patchGeo, logoMat);
    var patchBack = new THREE.Mesh(patchGeo, logoMat);
    patchBack.rotation.y = Math.PI;
    patch.visible = patchBack.visible = false;
    cupGroup.add(patch, patchBack);

    // The lid is its own group so it can drop onto the cup without ever passing through it.
    var lidGroup = new THREE.Group();
    var lidGeo = keep(lathe([[1.06, 2.33], [1.085, 2.38], [1.085, 2.46], [1.04, 2.5], [0.92, 2.5],
      [0.9, 2.56], [0.78, 2.66], [0.45, 2.74], [0.0, 2.76]], 56));
    lidGroup.add(new THREE.Mesh(lidGeo, lidMat));
    cupGroup.add(lidGroup);

    var shadowTex = keep(radialTexture([[0, 'rgba(0,0,0,0.55)'], [0.6, 'rgba(0,0,0,0.22)'], [1, 'rgba(0,0,0,0)']]));
    var shadowMat = keep(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    var shadowGeo = keep(new THREE.PlaneGeometry(3.4, 3.4));
    var shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01;
    root.add(shadow);

    var started = false, T = 0;
    function begin() { if (!started) { started = true; update(); } }
    new THREE.TextureLoader().load(opts.logoSrc || '', function (tex) {
      tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      logoMat.map = tex; logoMat.needsUpdate = true; patch.visible = patchBack.visible = true; keep(tex);
      if (reduce) draw();
      begin();
    }, undefined, function () { begin(); });
    setTimeout(begin, 1500);

    var rotY = 0, boost = 0;
    var running = false, visible = true, raf = 0, last = 0, destroyed = false;

    var LID_LAND = 1.0, LID_DUR = 0.5; // seconds
    function pose() {
      var pc = easeOutBounce(clamp01((T - 0.1) / 0.85));            // cup falls and bounces
      var pl = easeOutBounce(clamp01((T - LID_LAND) / LID_DUR));    // lid falls onto the rim
      var spin = (1 - easeOutCubic(clamp01((T - 0.1) / 1.1))) * TAU * 1.5;
      cupGroup.position.y = 4.4 * (1 - pc);
      lidGroup.position.y = 2.6 * (1 - pl);                         // always >= 0: never inside the cup
      var sq = T > 0.95 && T < 1.25 ? Math.sin((T - 0.95) / 0.3 * Math.PI) * 0.04 : 0;
      cupGroup.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
      shadowMat.opacity = clamp01((T - 0.1) / 0.9);
      var ss = 0.55 + 0.45 * pc; shadow.scale.set(ss, ss, ss);
      cupGroup.rotation.y = rotY + spin;
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

    if (reduce) { T = 99; rotY = -0.35; }
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
