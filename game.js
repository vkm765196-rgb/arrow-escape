/**
 * Arrow Escape - Core Game Engine
 * Features:
 * - Ultra-thin, sleek arrow lines (2.0px - 2.4px) matching mobile game aesthetic
 * - 100% Cell-by-Cell Raycast Collision (Guarantees blocked & surrounded arrows CANNOT exit)
 * - Zero Phasing: Input locked while arrow is escaping
 * - Dynamic Difficulty: Easy, Normal, Hard
 * - Responsive Direct Touch + Priority Proximity
 */

class BentArrowGame {
  constructor(containerEl, particleEngine) {
    this.container = containerEl;
    this.particles = particleEngine;
    this.svg = document.getElementById('game-svg');

    // Visual Palette
    this.arrowColor = '#1e293b';       // Deep crisp navy/slate
    this.activeColor = '#0284c7';      // Electric sky blue
    this.hintColor = '#eab308';        // Glow yellow
    this.bonkColor = '#ef4444';        // Danger red

    // Game state
    this.currentLevel = 1;
    this.maxLevels = 2000;
    this.difficulty = localStorage.getItem('arrow_game_difficulty') || 'Normal';
    this.level = null;
    this.arrows = [];
    this.lives = 5;
    this.maxLives = 5;
    this.moves = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimeout = null;
    this.hintsCount = 3;
    this.undoStack = [];
    this.isWon = false;
    this.isGameOver = false;
    this.isEscaping = false; // Lock flag to prevent phasing

    // Zoom & Pan System
    this.zoomLevel = 1.0;
    this.minZoom = 1.0;
    this.maxZoom = 4.0;
    this.panX = 0;
    this.panY = 0;
    this.baseWidth = 0;
    this.baseHeight = 0;

    // Callbacks
    this.onStateChange = null;
    this.onLevelWin = null;
    this.onGameOver = null;

    this.loadProgress();
    this.setupSvgGlobalTap();
  }

  loadProgress() {
    try {
      this.completedLevels = JSON.parse(localStorage.getItem('arrow_escape_1000_progress') || '{}');
      this.highestUnlocked = parseInt(localStorage.getItem('arrow_highest_unlocked') || '1', 10);
    } catch (e) {
      this.completedLevels = {};
      this.highestUnlocked = 1;
    }
  }

  saveProgress(levelId) {
    try {
      this.completedLevels[levelId] = { completed: true, date: Date.now() };
      this.highestUnlocked = Math.max(this.highestUnlocked, levelId + 1);
      localStorage.setItem('arrow_escape_1000_progress', JSON.stringify(this.completedLevels));
      localStorage.setItem('arrow_highest_unlocked', this.highestUnlocked.toString());
    } catch (e) {}
  }

  setDifficulty(diff) {
    if (['Easy', 'Normal', 'Hard'].includes(diff)) {
      this.difficulty = diff;
      localStorage.setItem('arrow_game_difficulty', diff);
      this.startLevel(this.currentLevel);
    }
  }

  startLevel(levelNumber = 1) {
    this.currentLevel = Math.max(1, Math.min(this.maxLevels, levelNumber));
    this.level = window.getLevelData(this.currentLevel, this.difficulty);
    this.initLevel(this.level);
  }

  nextLevel() {
    if (this.currentLevel < this.maxLevels) {
      this.startLevel(this.currentLevel + 1);
    }
  }

  prevLevel() {
    if (this.currentLevel > 1) {
      this.startLevel(this.currentLevel - 1);
    }
  }

  initLevel(levelData) {
    this.level = levelData;
    this.lives = this.maxLives;
    this.moves = 0;
    this.combo = 0;
    this.undoStack = [];
    this.isWon = false;
    this.isGameOver = false;
    this.isEscaping = false;

    // Sleek, compact grid scaling so arrows are packed tightly (pass me ho)
    const maxDim = Math.max(levelData.cols, levelData.rows);
    if (maxDim <= 12) {
      this.gridGap = 30;
      this.margin = 18;
      this.arrowStrokeWidth = 2.4;
    } else if (maxDim <= 18) {
      this.gridGap = 22;
      this.margin = 14;
      this.arrowStrokeWidth = 2.2;
    } else if (maxDim <= 26) {
      this.gridGap = 17;
      this.margin = 12;
      this.arrowStrokeWidth = 1.9;
    } else {
      this.gridGap = 14;
      this.margin = 10;
      this.arrowStrokeWidth = 1.6;
    }

    this.arrows = levelData.arrows.map((a, idx) => ({
      id: a.id || idx + 1,
      points: JSON.parse(JSON.stringify(a.points)),
      state: 'idle',
      groupEl: null,
      pathEl: null,
      headEl: null
    }));

    this.resetZoom();
    this.renderSVG();
    this.notifyState();
  }

  setZoom(level, clientX, clientY) {
    const oldZoom = this.zoomLevel;
    const clampedZoom = Math.min(this.maxZoom, Math.max(this.minZoom, Math.round(level * 100) / 100));
    if (Math.abs(clampedZoom - oldZoom) < 0.005) return;

    if (clientX !== undefined && clientY !== undefined && this.svg && this.baseWidth && this.baseHeight) {
      const rect = this.svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const normX = (clientX - rect.left) / rect.width - 0.5;
        const normY = (clientY - rect.top) / rect.height - 0.5;
        const oldW = this.baseWidth / oldZoom;
        const newW = this.baseWidth / clampedZoom;
        const oldH = this.baseHeight / oldZoom;
        const newH = this.baseHeight / clampedZoom;
        this.panX += normX * (oldW - newW);
        this.panY += normY * (oldH - newH);
      }
    }

    this.zoomLevel = clampedZoom;
    if (this.zoomLevel <= 1.001) {
      this.panX = 0;
      this.panY = 0;
      if (this.svg) this.svg.classList.remove('can-pan');
    } else {
      this.clampPan();
      if (this.svg) this.svg.classList.add('can-pan');
    }
    this.updateSvgViewBox();
    this.updateZoomUI();
  }

  resetZoom() {
    this.zoomLevel = 1.0;
    this.panX = 0;
    this.panY = 0;
    if (this.svg) {
      this.svg.classList.remove('can-pan');
      this.svg.classList.remove('is-panning');
    }
    this.updateSvgViewBox();
    this.updateZoomUI();
  }

  clampPan() {
    const curW = this.baseWidth / this.zoomLevel;
    const curH = this.baseHeight / this.zoomLevel;
    const maxPanX = (this.baseWidth - curW) / 2 + 15;
    const maxPanY = (this.baseHeight - curH) / 2 + 15;
    this.panX = Math.max(-maxPanX, Math.min(maxPanX, this.panX));
    this.panY = Math.max(-maxPanY, Math.min(maxPanY, this.panY));
  }

  updateSvgViewBox() {
    if (!this.svg || !this.baseWidth || !this.baseHeight) return;
    if (this.zoomLevel <= 1.001) {
      this.svg.setAttribute('viewBox', `0 0 ${this.baseWidth} ${this.baseHeight}`);
    } else {
      const curW = this.baseWidth / this.zoomLevel;
      const curH = this.baseHeight / this.zoomLevel;
      const vbX = (this.baseWidth - curW) / 2 - this.panX;
      const vbY = (this.baseHeight - curH) / 2 - this.panY;
      this.svg.setAttribute('viewBox', `${vbX} ${vbY} ${curW} ${curH}`);
    }
  }

  updateZoomUI() {
    const displayEl = document.getElementById('btn-zoom-reset');
    if (displayEl) {
      const pct = Math.round(this.zoomLevel * 100);
      displayEl.textContent = `${pct}%`;
      if (pct > 100) {
        displayEl.style.background = '#0284c7';
        displayEl.style.color = '#ffffff';
        displayEl.style.borderColor = '#0284c7';
      } else {
        displayEl.style.background = '#f0f9ff';
        displayEl.style.color = '#0284c7';
        displayEl.style.borderColor = '#bae6fd';
      }
    }
  }

  toPixel(gridX, gridY) {
    return {
      x: this.margin + gridX * this.gridGap,
      y: this.margin + gridY * this.gridGap
    };
  }

  setupSvgGlobalTap() {
    if (!this.svg) return;

    const activePointers = new Map();
    let startX = 0;
    let startY = 0;
    let downClientX = 0;
    let downClientY = 0;
    let hasMoved = false;
    let downTargetGroup = null;
    let initialPinchDist = null;
    let initialPinchZoom = 1.0;

    const onPointerDown = (e) => {
      // Ignore if clicking on zoom controls
      if (e.target.closest && e.target.closest('.zoom-controls-widget')) return;

      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1) {
        startX = e.clientX;
        startY = e.clientY;
        downClientX = e.clientX;
        downClientY = e.clientY;
        hasMoved = false;
        downTargetGroup = e.target.closest ? e.target.closest('.arrow-group') : null;
      } else if (activePointers.size === 2) {
        hasMoved = true;
        const pts = Array.from(activePointers.values());
        initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        initialPinchZoom = this.zoomLevel;
      }
    };

    const onPointerMove = (e) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Two-Finger Pinch-to-Zoom
      if (activePointers.size === 2 && initialPinchDist && initialPinchDist > 5) {
        hasMoved = true;
        const pts = Array.from(activePointers.values());
        const curDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const newZoom = initialPinchZoom * (curDist / initialPinchDist);
        this.setZoom(newZoom, midX, midY);
        return;
      }

      // One-Finger Pan / Drag
      if (activePointers.size === 1) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const dist = Math.hypot(dx, dy);

        if (dist > 8) {
          hasMoved = true;
          if (this.zoomLevel > 1.001) {
            this.svg.classList.add('is-panning');
            const svgRect = this.svg.getBoundingClientRect();
            if (svgRect.width > 0 && svgRect.height > 0) {
              const curW = this.baseWidth / this.zoomLevel;
              const curH = this.baseHeight / this.zoomLevel;
              const scaleX = curW / svgRect.width;
              const scaleY = curH / svgRect.height;

              this.panX += dx * scaleX;
              this.panY += dy * scaleY;
              this.clampPan();
              this.updateSvgViewBox();
            }
            startX = e.clientX;
            startY = e.clientY;
          }
        }
      }
    };

    const onPointerUp = (e) => {
      activePointers.delete(e.pointerId);

      if (activePointers.size === 0) {
        this.svg.classList.remove('is-panning');
        if (!hasMoved) {
          this.processTapAt(downTargetGroup, downClientX, downClientY);
        }
        hasMoved = false;
        initialPinchDist = null;
        downTargetGroup = null;
      }
    };

    this.svg.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    // Desktop Mouse Wheel Zoom (centered on cursor)
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.2 : 0.83;
      this.setZoom(this.zoomLevel * zoomFactor, e.clientX, e.clientY);
    }, { passive: false });
  }

  processTapAt(targetGroup, clientX, clientY) {
    if (this.isWon || this.isGameOver) return;

    let targetArrow = null;

    // 1. Direct Hit: User explicitly tapped directly on an arrow element
    if (targetGroup && targetGroup.dataset.arrowId) {
      const id = parseInt(targetGroup.dataset.arrowId, 10);
      targetArrow = this.arrows.find((a) => a.id === id && a.state === 'idle');
    }

    // 2. Proximity Assistance: ONLY for FREE (ready-to-escape) arrows!
    // We NEVER pick a blocked arrow if user tapped empty space (prevents heart breaking on random touch)
    if (!targetArrow) {
      const pt = this.svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = this.svg.getScreenCTM();
      if (ctm) {
        const svgP = pt.matrixTransform(ctm.inverse());
        let bestFree = null;
        let minFreeDist = Infinity;
        const assistThreshold = this.gridGap * 0.85;

        for (const arrow of this.arrows) {
          if (arrow.state !== 'idle') continue;
          const isFree = window.isArrowFreeToExit(arrow, this.arrows, this.level.cols, this.level.rows);
          if (!isFree) continue; // CRITICAL: NEVER select a blocked arrow from empty space tap!

          const d = this.getDistanceToArrow(svgP.x, svgP.y, arrow);
          if (d < minFreeDist && d <= assistThreshold) {
            minFreeDist = d;
            bestFree = arrow;
          }
        }
        if (bestFree) {
          targetArrow = bestFree;
        }
      }
    }

    // If user touched empty space where no arrow is, DO NOTHING! Zero hearts lost!
    if (!targetArrow) return;

    this.createTouchRipple(clientX, clientY);
    this.handleArrowTap(targetArrow);
  }

  getDistanceToArrow(px, py, arrow) {
    const pts = arrow.points.map((p) => this.toPixel(p.x, p.y));
    let minD = Infinity;

    for (let i = 0; i < pts.length - 1; i++) {
      const v = pts[i];
      const w = pts[i + 1];
      const l2 = Math.hypot(v.x - w.x, v.y - w.y) ** 2;
      let t = l2 === 0 ? 0 : ((px - v.x) * (w.x - v.x) + (py - v.y) * (w.y - v.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      const projX = v.x + t * (w.x - v.x);
      const projY = v.y + t * (w.y - v.y);
      const d = Math.hypot(px - projX, py - projY);
      if (d < minD) minD = d;
    }

    return minD;
  }

  renderSVG() {
    if (!this.svg) return;
    this.svg.innerHTML = '';

    const { cols, rows } = this.level;
    this.baseWidth = (cols - 1) * this.gridGap + 2 * this.margin;
    this.baseHeight = (rows - 1) * this.gridGap + 2 * this.margin;

    this.updateSvgViewBox();
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.svg.style.width = '100%';
    this.svg.style.height = '100%';
    this.svg.style.maxHeight = '68vh';

    // Glow filters
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <filter id="electric-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="#0284c7" flood-opacity="0.9"/>
      </filter>
      <filter id="hint-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#eab308" flood-opacity="0.95"/>
      </filter>
    `;
    this.svg.appendChild(defs);

    // Collect all cells occupied by arrows to guarantee ZERO empty dotted area!
    const occupiedCoords = new Set();
    this.arrows.forEach((arrow) => {
      for (let i = 0; i < arrow.points.length - 1; i++) {
        const p1 = arrow.points[i];
        const p2 = arrow.points[i + 1];
        const stepX = Math.sign(p2.x - p1.x);
        const stepY = Math.sign(p2.y - p1.y);
        let sx = p1.x, sy = p1.y;
        while (true) {
          occupiedCoords.add(`${sx},${sy}`);
          if (sx === p2.x && sy === p2.y) break;
          sx += stepX;
          sy += stepY;
        }
      }
    });

    // 1. Dot Grid Layer: ONLY render dots for occupied puzzle cells!
    const dotsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dotsGroup.setAttribute('class', 'dot-grid-layer');

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!occupiedCoords.has(`${c},${r}`)) continue; // CRITICAL: NEVER show an empty dot!
        const pix = this.toPixel(c, r);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pix.x);
        circle.setAttribute('cy', pix.y);
        circle.setAttribute('r', '2.0');
        circle.setAttribute('fill', '#cbd5e1');
        dotsGroup.appendChild(circle);
      }
    }
    this.svg.appendChild(dotsGroup);

    // 2. Arrows Layer
    const arrowsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    arrowsGroup.setAttribute('class', 'arrows-layer');

    this.arrows.forEach((arrow) => {
      if (arrow.state === 'escaped') return;
      const arrowG = this.createArrowElement(arrow);
      arrow.groupEl = arrowG;
      arrow.pathEl = arrowG.querySelector('.arrow-stroke');
      arrow.headEl = arrowG.querySelector('.arrow-head-poly');
      arrowsGroup.appendChild(arrowG);
    });

    this.svg.appendChild(arrowsGroup);
  }

  createArrowElement(arrow) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'arrow-group cursor-pointer');
    g.dataset.arrowId = arrow.id;

    const pixelPoints = arrow.points.map((p) => this.toPixel(p.x, p.y));
    let pathD = `M ${pixelPoints[0].x} ${pixelPoints[0].y}`;
    for (let i = 1; i < pixelPoints.length; i++) {
      pathD += ` L ${pixelPoints[i].x} ${pixelPoints[i].y}`;
    }

    const n = pixelPoints.length;
    const head = pixelPoints[n - 1];
    const prev = pixelPoints[n - 2];
    const dx = Math.sign(head.x - prev.x);
    const dy = Math.sign(head.y - prev.y);

    const maxDim = Math.max(this.level.cols, this.level.rows);
    const tipLen = maxDim > 22 ? 5.2 : maxDim > 16 ? 6.5 : 8.0;
    const tipW = maxDim > 22 ? 2.6 : maxDim > 16 ? 3.2 : 4.0;
    const pHead = `${head.x},${head.y}`;
    const pL = `${head.x - dx * tipLen - dy * tipW},${head.y - dy * tipLen - dx * tipW}`;
    const pR = `${head.x - dx * tipLen + dy * tipW},${head.y - dy * tipLen + dx * tipW}`;

    const hitStroke = Math.max(16, Math.min(24, this.gridGap * 0.7));

    g.innerHTML = `
      <path d="${pathD}" fill="none" stroke="transparent" stroke-width="${hitStroke}" stroke-linecap="round" stroke-linejoin="round" class="arrow-hitarea" />
      <path d="${pathD}" fill="none" stroke="${this.arrowColor}" stroke-width="${this.arrowStrokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="arrow-stroke" />
      <polygon points="${pHead} ${pL} ${pR}" fill="${this.arrowColor}" class="arrow-head-poly" />
    `;

    return g;
  }

  handleArrowTap(arrow) {
    if (this.isWon || this.isGameOver) return;
    if (arrow.state !== 'idle') return;

    this.moves++;
    const isFree = window.isArrowFreeToExit(arrow, this.arrows, this.level.cols, this.level.rows);

    if (isFree) {
      this.executeSlowTrackSlidingEscape(arrow);
    } else {
      this.executeSlowTrackBonk(arrow);
    }

    this.notifyState();
  }

  createTouchRipple(screenX, screenY) {
    const ripple = document.createElement('div');
    ripple.className = 'touch-ripple';
    ripple.style.left = `${screenX}px`;
    ripple.style.top = `${screenY}px`;
    document.body.appendChild(ripple);
    setTimeout(() => {
      if (ripple.parentElement) ripple.parentElement.removeChild(ripple);
    }, 450);
  }

  executeSlowTrackSlidingEscape(arrow) {
    this.isEscaping = true;
    arrow.state = 'flying';
    const g = arrow.groupEl;
    const pathEl = arrow.pathEl;
    const headEl = arrow.headEl;
    if (!g || !pathEl || !headEl) {
      this.isEscaping = false;
      return;
    }

    this.undoStack.push({
      arrowId: arrow.id,
      score: this.score,
      combo: this.combo
    });

    this.combo++;
    if (this.comboTimeout) clearTimeout(this.comboTimeout);
    this.comboTimeout = setTimeout(() => {
      this.combo = 0;
      this.notifyState();
    }, 2800);

    if (window.sound) {
      window.sound.playWhoosh();
      window.sound.playChime(this.combo);
    }

    pathEl.setAttribute('stroke', this.activeColor);
    pathEl.setAttribute('stroke-width', (this.arrowStrokeWidth + 0.4).toString());
    pathEl.setAttribute('filter', 'url(#electric-glow)');
    headEl.setAttribute('fill', this.activeColor);
    headEl.setAttribute('filter', 'url(#electric-glow)');

    const pts = arrow.points.map((p) => this.toPixel(p.x, p.y));
    const n = pts.length;
    const headPt = pts[n - 1];
    const prevPt = pts[n - 2];
    const dx = Math.sign(headPt.x - prevPt.x);
    const dy = Math.sign(headPt.y - prevPt.y);

    const exitDistance = 1200;
    const exitPt = {
      x: headPt.x + dx * exitDistance,
      y: headPt.y + dy * exitDistance
    };
    const track = [...pts, exitPt];

    const arrowLen = window.getPolylineLength(pts);
    const trackLen = window.getPolylineLength(track);

    const startTime = performance.now();
    // Visibly SLOW, calm, graceful slither escape (~1400ms to 2200ms)
    const duration = Math.max(1400, Math.min(2200, (arrowLen + 250) * 3.8));
    const totalTravel = trackLen + 100;

    const maxDim = Math.max(this.level.cols, this.level.rows);
    const tipLen = maxDim > 24 ? 4.8 : maxDim > 18 ? 6.2 : maxDim > 14 ? 7.2 : 8.5;
    const tipW = maxDim > 24 ? 2.4 : maxDim > 18 ? 3.0 : maxDim > 14 ? 3.6 : 4.2;

    const animateSlither = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const ease = progress < 0.08
        ? 0.5 * Math.pow(progress / 0.08, 2) * 0.08
        : progress;

      const slideDist = ease * totalTravel;
      const dStart = slideDist;
      const dEnd = arrowLen + slideDist;

      if (progress >= 1 || dStart >= trackLen) {
        arrow.state = 'escaped';
        this.isEscaping = false;
        if (g.parentElement) g.parentElement.removeChild(g);
        this.checkWinCondition();
        this.notifyState();
        return;
      }

      const subPts = window.sampleTrackSubPolyline(track, dStart, dEnd);

      if (!subPts || subPts.length < 2) {
        arrow.state = 'escaped';
        this.isEscaping = false;
        if (g.parentElement) g.parentElement.removeChild(g);
        this.checkWinCondition();
        this.notifyState();
        return;
      }

      let pathD = `M ${subPts[0].x} ${subPts[0].y}`;
      for (let i = 1; i < subPts.length; i++) {
        pathD += ` L ${subPts[i].x} ${subPts[i].y}`;
      }
      pathEl.setAttribute('d', pathD);

      const curHead = subPts[subPts.length - 1];
      const curPrev = subPts[subPts.length - 2];
      const segDx = curHead.x - curPrev.x;
      const segDy = curHead.y - curPrev.y;
      const segDist = Math.hypot(segDx, segDy);

      if (segDist > 0.1) {
        const uX = segDx / segDist;
        const uY = segDy / segDist;
        const pHead = `${curHead.x},${curHead.y}`;
        const pL = `${curHead.x - uX * tipLen - uY * tipW},${curHead.y - uY * tipLen - uX * tipW}`;
        const pR = `${curHead.x - uX * tipLen + uY * tipW},${curHead.y - uY * tipLen + uX * tipW}`;
        headEl.setAttribute('points', `${pHead} ${pL} ${pR}`);
      }

      requestAnimationFrame(animateSlither);
    };

    requestAnimationFrame(animateSlither);

    if (this.particles) {
      this.particles.sparks(headPt.x, headPt.y, 8, this.activeColor);
    }
  }

  executeSlowTrackBonk(arrow) {
    arrow.state = 'blocked';
    const g = arrow.groupEl;
    const pathEl = arrow.pathEl;
    const headEl = arrow.headEl;
    if (!g || !pathEl || !headEl) return;

    this.lives = Math.max(0, this.lives - 1);
    this.combo = 0;

    if (window.sound) {
      window.sound.playBonk();
    }

    pathEl.setAttribute('stroke', this.bonkColor);
    headEl.setAttribute('fill', this.bonkColor);

    const pts = arrow.points.map((p) => this.toPixel(p.x, p.y));
    const headPt = pts[pts.length - 1];
    const prevPt = pts[pts.length - 2];
    const dx = Math.sign(headPt.x - prevPt.x);
    const dy = Math.sign(headPt.y - prevPt.y);

    const track = [...pts, { x: headPt.x + dx * 24, y: headPt.y + dy * 24 }];
    const arrowLen = window.getPolylineLength(pts);

    const bonkStart = performance.now();
    const bonkDuration = 320;

    const animateBonk = (now) => {
      const elapsed = now - bonkStart;
      const t = Math.min(elapsed / bonkDuration, 1);

      const nudge = Math.sin(t * Math.PI) * 9;
      const dStart = nudge;
      const dEnd = arrowLen + nudge;

      const subPts = window.sampleTrackSubPolyline(track, dStart, dEnd);

      if (subPts && subPts.length >= 2) {
        let pathD = `M ${subPts[0].x} ${subPts[0].y}`;
        for (let i = 1; i < subPts.length; i++) {
          pathD += ` L ${subPts[i].x} ${subPts[i].y}`;
        }
        pathEl.setAttribute('d', pathD);
      }

      if (t < 1) {
        requestAnimationFrame(animateBonk);
      } else {
        let origD = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) {
          origD += ` L ${pts[i].x} ${pts[i].y}`;
        }
        pathEl.setAttribute('d', origD);
        pathEl.setAttribute('stroke', this.arrowColor);

        const maxDim = Math.max(this.level.cols, this.level.rows);
        const tipLen = maxDim > 24 ? 4.8 : maxDim > 18 ? 6.2 : maxDim > 14 ? 7.2 : 8.5;
        const tipW = maxDim > 24 ? 2.4 : maxDim > 18 ? 3.0 : maxDim > 14 ? 3.6 : 4.2;
        const pHead = `${headPt.x},${headPt.y}`;
        const pL = `${headPt.x - dx * tipLen - dy * tipW},${headPt.y - dy * tipLen - dx * tipW}`;
        const pR = `${headPt.x - dx * tipLen + dy * tipW},${headPt.y - dy * tipLen + dx * tipW}`;
        headEl.setAttribute('points', `${pHead} ${pL} ${pR}`);
        headEl.setAttribute('fill', this.arrowColor);

        arrow.state = 'idle';

        if (this.lives <= 0) {
          this.isGameOver = true;
          if (this.onGameOver) this.onGameOver();
        }
        this.notifyState();
      }
    };

    requestAnimationFrame(animateBonk);
  }

  useHint() {
    if (this.hintsCount <= 0 || this.isWon || this.isGameOver || this.isEscaping) return;

    const freeArrow = this.arrows.find((a) => a.state === 'idle' && window.isArrowFreeToExit(a, this.arrows, this.level.cols, this.level.rows));
    if (!freeArrow || !freeArrow.groupEl) return;

    this.hintsCount--;
    const pathEl = freeArrow.pathEl;
    const headEl = freeArrow.headEl;

    pathEl.setAttribute('stroke', '#eab308');
    pathEl.setAttribute('filter', 'url(#hint-glow)');
    headEl.setAttribute('fill', '#eab308');
    headEl.setAttribute('filter', 'url(#hint-glow)');

    setTimeout(() => {
      if (freeArrow.state === 'idle') {
        pathEl.setAttribute('stroke', this.arrowColor);
        pathEl.removeAttribute('filter');
        headEl.setAttribute('fill', this.arrowColor);
        headEl.removeAttribute('filter');
      }
    }, 2400);

    this.notifyState();
  }

  undo() {
    if (this.undoStack.length === 0 || this.isWon || this.isGameOver) return;
    const lastAction = this.undoStack.pop();
    const arrow = this.arrows.find((a) => a.id === lastAction.arrowId);
    if (!arrow) return;

    arrow.state = 'idle';
    this.renderSVG();
    this.notifyState();
  }

  checkWinCondition() {
    const remaining = this.arrows.filter((a) => a.state !== 'escaped');
    if (remaining.length === 0 && !this.isWon) {
      this.isWon = true;
      this.saveProgress(this.currentLevel);

      if (window.sound) {
        window.sound.playVictory();
      }
      if (this.particles) {
        this.particles.confettiRain(100);
      }

      if (this.onLevelWin) {
        this.onLevelWin(this.currentLevel);
      }
    }
  }

  notifyState() {
    const remaining = this.arrows.filter((a) => a.state !== 'escaped').length;
    if (this.onStateChange) {
      this.onStateChange({
        levelIndex: this.currentLevel,
        levelName: this.level ? this.level.name : `Level ${this.currentLevel}`,
        difficulty: this.difficulty,
        remainingArrows: remaining,
        totalArrows: this.arrows.length,
        lives: this.lives,
        moves: this.moves,
        combo: this.combo,
        hintsCount: this.hintsCount,
        isWon: this.isWon,
        isGameOver: this.isGameOver
      });
    }
  }
}

window.BentArrowGame = BentArrowGame;
