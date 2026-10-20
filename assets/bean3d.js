/*
 * Starlaban Coffee: 3D coffee bean with a star.
 * Needs three.min.js (r149, global THREE) loaded first.
 *
 *   var bean = StarlabanBean.mount(document.getElementById('bean'), {
 *     fallbackSrc: 'assets/logo.png'   // shown when WebGL is missing
 *   });
 *   bean.burst();     // quick celebratory spin
 *   bean.destroy();
 *
 * Behaviour: slow auto-rotate, drag/swipe to spin (vertical page scroll still works),
 * pauses when off screen or tab hidden, still frame when reduced motion is on.
 */
(function (global) {
  'use strict';

  var A = 1, B = 1.35, C = 0.72; // bean half-sizes (x, y, z)

  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(global.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  function surfaceZ(x, y) {
    var v = 1 - (x / A) * (x / A) - (y / B) * (y / B);
    return v > 0 ? C * Math.sqrt(v) : 0;
  }

  function starShape(outer, inner) {
    var s = new THREE.Shape();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 ? inner : outer;
      var a = Math.PI / 2 + i * Math.PI / 5;
      var x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i) s.lineTo(x, y); else s.moveTo(x, y);
    }
    s.closePath();
    return s;
  }

  // Star that hugs the bean surface.
  function starGeometry() {
    var g = new THREE.ExtrudeGeometry(starShape(0.56, 0.24), {
      depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02,
      bevelSegments: 2, curveSegments: 1
    });
    var p = g.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      p.setZ(i, surfaceZ(x, y) + z - 0.012);
    }
    g.computeVertexNormals();
    return g;
  }

  // The curved split down the bean.
  function creaseGeometry() {
    var pts = [];
    for (var i = 0; i <= 40; i++) {
      var t = i / 40;
      var y = 1.12 - 2.24 * t;
      var x = 0.4 * Math.sin(t * Math.PI * 1.55 - 0.25);
      pts.push(new THREE.Vector3(x, y, surfaceZ(x, y) + 0.015));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.032, 6, false);
  }

  function showFallback(el, src) {
    el.classList.add('bean3d-fallback');
    if (src && !el.querySelector('img')) {
      var img = document.createElement('img');
      img.src = src; img.alt = 'Starlaban Coffee logo';
      img.style.cssText = 'max-width:100%;max-height:100%;border-radius:50%';
      el.appendChild(img);
    }
  }

  function mount(el, opts) {
    opts = opts || {};
    if (!el) return null;
    if (typeof THREE === 'undefined' || !hasWebGL()) {
      showFallback(el, opts.fallbackSrc);
      return { burst: function () {}, destroy: function () {}, ok: false };
    }

    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch (e) {
      showFallback(el, opts.fallbackSrc);
      return { burst: function () {}, destroy: function () {}, ok: false };
    }
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    var canvas = renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab';
    canvas.setAttribute('aria-hidden', 'true');
    while (el.firstChild) el.removeChild(el.firstChild); // clear fallback image
    el.appendChild(canvas);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0, 6.4);

    scene.add(new THREE.HemisphereLight(0xfff1de, 0x1a0d07, 0.55));
    var key = new THREE.DirectionalLight(0xfff0dc, 0.95); key.position.set(3, 4, 5); scene.add(key);
    var rim = new THREE.DirectionalLight(0xc4955a, 0.9); rim.position.set(-4, 1, -3); scene.add(rim);

    var beanMat = new THREE.MeshStandardMaterial({ color: 0x2e1a0f, roughness: 0.45, metalness: 0.08 });
    var starMat = new THREE.MeshStandardMaterial({ color: 0xe9cfae, roughness: 0.6, metalness: 0.05 });
    var sphereGeo = new THREE.SphereGeometry(1, 64, 48);
    var sGeo = starGeometry(), cGeo = creaseGeometry();

    var bean = new THREE.Group();
    var body = new THREE.Mesh(sphereGeo, beanMat);
    body.scale.set(A, B, C);
    bean.add(body);
    function face() {
      var f = new THREE.Group();
      f.add(new THREE.Mesh(sGeo, starMat), new THREE.Mesh(cGeo, starMat));
      return f;
    }
    var front = face(), back = face();
    back.rotation.y = Math.PI;
    bean.add(front, back);

    var pivot = new THREE.Group(); // tilt like the logo, spin inside
    pivot.rotation.z = -0.16;
    pivot.add(bean);
    scene.add(pivot);

    var rotY = reduce ? -0.5 : 0, vel = 0.0, boost = 0, bob = 0;
    var AUTO = 0.55; // radians per second
    var dragging = false, lastX = 0, lastT = 0, dragVel = 0;
    var running = false, visible = true, raf = 0, last = 0, destroyed = false;

    function size() {
      var w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      draw();
    }
    function draw() {
      bean.rotation.y = rotY;
      pivot.position.y = Math.sin(bob) * 0.06;
      renderer.render(scene, camera);
    }
    function frame(now) {
      raf = 0;
      if (!running || destroyed) return;
      var dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
      if (!dragging) {
        // ease the spin speed back to the idle rate
        var target = reduce ? 0 : AUTO;
        vel += (target - vel) * Math.min(1, dt * 2.2);
        rotY += (vel + boost) * dt;
        boost *= Math.pow(0.04, dt);
        if (boost < 0.01) boost = 0;
      }
      bob += dt * 1.4;
      draw();
      raf = requestAnimationFrame(frame);
    }
    function update() {
      var should = visible && !document.hidden && !reduce;
      if (should && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
      else if (!should && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    }

    // pointer drag
    canvas.addEventListener('pointerdown', function (e) {
      dragging = true; lastX = e.clientX; lastT = performance.now(); dragVel = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
      canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var now = performance.now(), dx = e.clientX - lastX, dt = Math.max(now - lastT, 1) / 1000;
      rotY += dx * 0.012; dragVel = (dx * 0.012) / dt;
      lastX = e.clientX; lastT = now;
      if (!running) draw();
    });
    function release() {
      if (!dragging) return;
      dragging = false; canvas.style.cursor = 'grab';
      vel = Math.max(-8, Math.min(8, dragVel)); // keep the flick momentum
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);

    // keep working if the phone drops the GL context
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); running = false; showFallback(el, opts.fallbackSrc);
    });

    var io = null, ro = null;
    if ('IntersectionObserver' in global) {
      io = new IntersectionObserver(function (en) { visible = en[0].isIntersecting; update(); });
      io.observe(el);
    }
    if ('ResizeObserver' in global) { ro = new ResizeObserver(size); ro.observe(el); }
    else global.addEventListener('resize', size);
    document.addEventListener('visibilitychange', update);

    size(); update();

    return {
      ok: true,
      burst: function () {
        if (reduce) { rotY += Math.PI * 2; draw(); return; }
        boost = 9;
      },
      destroy: function () {
        destroyed = true; running = false;
        if (raf) cancelAnimationFrame(raf);
        if (io) io.disconnect(); if (ro) ro.disconnect();
        document.removeEventListener('visibilitychange', update);
        sphereGeo.dispose(); sGeo.dispose(); cGeo.dispose(); beanMat.dispose(); starMat.dispose();
        renderer.dispose();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  global.StarlabanBean = { mount: mount };
})(window);
