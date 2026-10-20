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
 * Load-in: cup drops and bounces, lid lands, steam starts rising.
 * Idle: gentle sway, drag/swipe to spin (vertical page scroll still works).
 * Pauses off screen / hidden tab; still frame for prefers-reduced-motion.
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var CUP_H = 2.35, R_BOT = 0.70, R_TOP = 0.98;
  function radiusAt(y) { return R_BOT + (R_TOP - R_BOT) * (y / CUP_H); }

  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(global.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeOutCubic(p) { return 1 - Math.pow(1 - p, 3); }
  function easeOutBack(p) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }
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
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab';
    canvas.setAttribute('aria-hidden', 'true');
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(canvas);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    camera.position.set(0, 2.5, 9.4);
    camera.lookAt(0, 1.7, 0);

    scene.add(new THREE.HemisphereLight(0xfff1de, 0x2a160c, 0.75));
    var key = new THREE.DirectionalLight(0xfff0dc, 1.0); key.position.set(3, 5, 5); scene.add(key);
    var rim = new THREE.DirectionalLight(0xc4955a, 0.8); rim.position.set(-4, 2, -3); scene.add(rim);

    var disposables = [];
    function keep(o) { disposables.push(o); return o; }

    // ---- cup parts ----
    var paper = keep(new THREE.MeshStandardMaterial({ color: 0xf3e3cf, roughness: 0.85, metalness: 0 }));
    var sleeveMat = keep(new THREE.MeshStandardMaterial({ color: 0x3a2113, roughness: 0.75, metalness: 0 }));
    var lidMat = keep(new THREE.MeshStandardMaterial({ color: 0x2e1a0f, roughness: 0.4, metalness: 0.08 }));
    var logoMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, transparent: true, alphaTest: 0.02 }));

    var cupGroup = new THREE.Group();
    var root = new THREE.Group();
    root.add(cupGroup);
    scene.add(root);

    // body (paper), open top hidden by the lid
    var bodyGeo = keep(lathe([[0, 0], [R_BOT - 0.04, 0], [R_BOT, 0.05], [R_TOP, CUP_H], [R_TOP + 0.03, CUP_H + 0.05]], 56));
    var body = new THREE.Mesh(bodyGeo, paper);
    body.material.side = THREE.DoubleSide;
    cupGroup.add(body);

    // sleeve
    var SY0 = 0.55, SY1 = 1.95, sp = [];
    for (var i = 0; i <= 8; i++) { var y = SY0 + (SY1 - SY0) * i / 8; sp.push([radiusAt(y) + 0.02, y]); }
    var sleeveGeo = keep(lathe(sp, 56));
    var sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
    sleeve.material.side = THREE.DoubleSide;
    cupGroup.add(sleeve);

    // logo patch on the sleeve (square: arc width equals height)
    var LY0 = 0.7, LY1 = 1.8, lp = [];
    for (var j = 0; j <= 6; j++) { var ly = LY0 + (LY1 - LY0) * j / 6; lp.push([radiusAt(ly) + 0.035, ly]); }
    var arc = (LY1 - LY0) / radiusAt((LY0 + LY1) / 2);
    var patchGeo = keep(lathe(lp, 32, -arc / 2, arc));
    var patch = new THREE.Mesh(patchGeo, logoMat);
    patch.visible = false;
    var patchBack = new THREE.Mesh(patchGeo, logoMat);
    patchBack.rotation.y = Math.PI; patchBack.visible = false;
    cupGroup.add(patch, patchBack);

    // lid
    var lidGeo = keep(lathe([[1.06, 2.33], [1.085, 2.38], [1.085, 2.46], [1.04, 2.5], [0.92, 2.5],
      [0.9, 2.56], [0.78, 2.66], [0.45, 2.74], [0.0, 2.76]], 56));
    var lid = new THREE.Mesh(lidGeo, lidMat);
    lid.material.side = THREE.DoubleSide;
    cupGroup.add(lid);

    // ground shadow
    var shadowTex = keep(radialTexture([[0, 'rgba(0,0,0,0.55)'], [0.6, 'rgba(0,0,0,0.22)'], [1, 'rgba(0,0,0,0)']]));
    var shadowMat = keep(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    var shadowGeo = keep(new THREE.PlaneGeometry(3.4, 3.4));
    var shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01;
    root.add(shadow);

    // steam
    var steamTex = keep(radialTexture([[0, 'rgba(255,245,232,0.9)'], [0.5, 'rgba(255,245,232,0.35)'], [1, 'rgba(255,245,232,0)']]));
    var steam = [], N = 14;
    for (var s = 0; s < N; s++) {
      var sm = keep(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
      var sp2 = new THREE.Sprite(sm); sp2.userData.phase = s / N; sp2.userData.seed = Math.random() * 6.28;
      root.add(sp2); steam.push(sp2);
    }

    // logo texture
    var started = false, T = 0;
    function begin() { if (!started) { started = true; update(); } }
    new THREE.TextureLoader().load(opts.logoSrc || '', function (tex) {
      tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      logoMat.map = tex; logoMat.needsUpdate = true; patch.visible = true; patchBack.visible = true; keep(tex);
      if (reduce) { T = 99; draw(); }
      begin();
    }, undefined, function () { begin(); });
    setTimeout(begin, 1500); // never wait forever for the texture

    // ---- state / animation ----
    var rotY = 0, vel = 0, dragging = false, lastX = 0, lastT = 0, dragVel = 0, idleT = 0;
    var running = false, visible = true, raf = 0, last = 0, destroyed = false;

    function pose() {
      // drop-in timeline (seconds since start)
      var pc = easeOutBounce(clamp01((T - 0.1) / 0.85));      // cup falls and bounces
      var pl = easeOutBack(clamp01((T - 0.8) / 0.45));        // lid settles on
      var spin = (1 - easeOutCubic(clamp01((T - 0.1) / 1.1))) * TAU * 1.5;
      cupGroup.position.y = 4.4 * (1 - pc);
      lid.position.y = T < 0.8 ? 3.6 : 2.6 * (1 - pl);
      var squash = 1 + (T > 0.95 && T < 1.25 ? Math.sin((T - 0.95) / 0.3 * Math.PI) * 0.04 : 0);
      cupGroup.scale.set(1 + (1 - squash) * 0.5, squash, 1 + (1 - squash) * 0.5);
      shadowMat.opacity = clamp01((T - 0.1) / 0.9);
      var ss = 0.55 + 0.45 * pc; shadow.scale.set(ss, ss, ss);
      cupGroup.rotation.y = rotY + spin;
      // steam
      var fade = clamp01((T - 1.35) / 0.8);
      for (var k = 0; k < steam.length; k++) {
        var u = steam[k].userData, p = ((T * 0.28 + u.phase) % 1);
        steam[k].position.set(Math.sin(T * 1.1 + u.seed) * 0.12 * (0.4 + p), 2.9 + p * 1.45, 0.1 * Math.cos(u.seed));
        var sc = 0.45 + p * 0.75; steam[k].scale.set(sc, sc, 1);
        steam[k].material.opacity = Math.sin(p * Math.PI) * 0.26 * fade;
      }
    }
    function size() {
      var w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // keep the whole cup + steam in frame on narrow/short boxes
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
      if (!dragging) {
        if (Math.abs(vel) > 0.35) { rotY += vel * dt; vel *= Math.pow(0.12, dt); idleT = 0; }
        else {
          vel = 0; idleT += dt;
          // ease back to facing front, then sway gently
          var front = Math.round(rotY / TAU) * TAU;
          var want = front + Math.sin(idleT * 0.8) * 0.42;
          rotY += (want - rotY) * Math.min(1, dt * 2.2);
        }
      }
      draw();
      raf = requestAnimationFrame(frame);
    }
    function update() {
      var should = started && visible && !document.hidden && !reduce;
      if (should && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
      else if (!should && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    }

    canvas.addEventListener('pointerdown', function (e) {
      dragging = true; lastX = e.clientX; lastT = performance.now(); dragVel = 0; vel = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
      canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var now = performance.now(), dx = e.clientX - lastX, dt = Math.max(now - lastT, 1) / 1000;
      rotY += dx * 0.012; dragVel = (dx * 0.012) / dt; lastX = e.clientX; lastT = now;
      if (!running) draw();
    });
    function release() {
      if (!dragging) return;
      dragging = false; canvas.style.cursor = 'grab';
      vel = Math.max(-10, Math.min(10, dragVel));
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);
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
      burst: function () { if (reduce) { rotY += TAU; draw(); } else { vel = 12; } },
      replay: function () { if (reduce) return; T = 0; rotY = 0; vel = 0; idleT = 0; update(); },
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
