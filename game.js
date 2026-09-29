/**
 * Arrow Escape - 1000 Levels Game Engine
 * Fixes:
 * - Guaranteed Clean Animation Termination (No arrow freezes or gets stuck)
 * - Intelligent Proximity Touch Detection (No overlapping hit-area glitches)
 * - Smooth, Calm Corner-Slithering along the Track
 */

class BentArrowGame {
  constructor(container, particleEngine) {
    this.container = container;
    this.particles = particleEngine;
    this.svg = document.getElementById('game-svg');

    // Visual styles
    this.arrowStrokeWidth = 3.2;
    this.arrowColor = '#131e3a'; // Deep navy
    this.activeColor = '#0284c7'; // Electric cyan blue

    // Game state
    this.currentLevel = 1;
    this.maxLevels = 1000;
    this.level = null;
    this.arrows = [];
    this.lives = 3;
    this.maxLives = 3;
    this.moves = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimeout = null;
    this.hintsCount = 3;
    this.undoStack = [];
    this.isWon = false;
    this.isGameOver = false;

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

  startLevel(levelNumber = 1) {
    this.currentLevel = Math.max(1, Math.min(this.maxLevels, levelNumber));
    this.level = window.getLevelData(this.currentLevel);
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

    // Responsive scaling based on grid dimensions
    const maxDim = Math.max(levelData.cols, levelData.rows);
    if (maxDim <= 8) {
      this.gridGap = 42;
      this.margin = 32;
      this.arrowStrokeWidth = 3.5;
    } else if (maxDim <= 11) {
      this.gridGap = 36;
      this.margin = 28;
      this.arrowStrokeWidth = 3.2;
    } else if (maxDim <= 14) {
      this.gridGap = 30;
      this.margin = 24;
      this.arrowStrokeWidth = 2.9;
    } else {
      this.gridGap = 26;
      this.margin = 20;
      this.arrowStrokeWidth = 2.6;
    }

    this.arrows = levelData.arrows.map((a, idx) => ({
      id: a.id || idx + 1,
      points: JSON.parse(JSON.stringify(a.points)),
      state: 'idle',
      groupEl: null,
      pathEl: null,
      headEl: null
    }));

    this.renderSVG();
    this.notifyState();
  }

  toPixel(gridX, gridY) {
    return {
      x: this.margin + gridX * this.gridGap,
      y: this.margin + gridY * this.gridGap
    };
  }

  setupSvgGlobalTap() {
    if (!this.svg) return;

    this.svg.addEventListener('pointerdown', (e) => {
      if (this.isWon || this.isGameOver) return;

      // Convert screen touch to SVG coordinate system
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = this.svg.getScreenCTM();
      if (!ctm) return;
      const svgP = pt.matrixTransform(ctm.inverse());

      // Intelligent Closest Arrow Picker: prevents overlapping hit-area bugs
      let bestArrow = null;
      let minDistance = Infinity;
      const touchThreshold = this.gridGap * 0.72; // generous touch zone

      for (const arrow of this.arrows) {
        if (arrow.state !== 'idle') continue;
        const d = this.getDistanceToArrow(svgP.x, svgP.y, arrow);
        if (d < minDistance && d <= touchThreshold) {
          minDistance = d;
          bestArrow = arrow;
        }
      }

      if (bestArrow) {
        this.createTouchRipple(e.clientX, e.clientY);
        this.handleArrowTap(bestArrow);
      }
    });
  }

  // Calculate perpendicular distance from point (px, py) to arrow polyline
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
    const svgWidth = (cols - 1) * this.gridGap + 2 * this.margin;
    const svgHeight = (rows - 1) * this.gridGap + 2 * this.margin;

    this.svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.svg.style.width = '100%';
    this.svg.style.height = '100%';
    this.svg.style.maxHeight = '68vh';

    // Glow filters
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <filter id="electric-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="0" stdDeviation="4.5" flood-color="#0284c7" flood-opacity="0.95"/>
      </filter>
      <filter id="hint-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#eab308" flood-opacity="0.95"/>
      </filter>
    `;
    this.svg.appendChild(defs);

    // 1. Dot Grid Layer
    const dotsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dotsGroup.setAttribute('class', 'dot-grid-layer');

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (this.level.shape && !isInsideMask(this.level.shape, c, r, cols, rows)) {
          continue;
        }
        const pt = this.toPixel(c, r);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pt.x);
        circle.setAttribute('cy', pt.y);
        circle.setAttribute('r', '2.2');
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

    const tipLen = 10.5;
    const tipW = 5.5;
    const pHead = `${head.x},${head.y}`;
    const pL = `${head.x - dx * tipLen - dy * tipW},${head.y - dy * tipLen - dx * tipW}`;
    const pR = `${head.x - dx * tipLen + dy * tipW},${head.y - dy * tipLen + dx * tipW}`;

    // Hit-stroke width tightly bounded so neighboring arrows NEVER overlap
    const hitStroke = Math.max(12, Math.min(16, this.gridGap * 0.5));

    g.innerHTML = `
      <path d="${pathD}" fill="none" stroke="transparent" stroke-width="${hitStroke}" stroke-linecap="round" stroke-linejoin="round" class="arrow-hitarea" />
      <path d="${pathD}" fill="none" stroke="${this.arrowColor}" stroke-width="${this.arrowStrokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="arrow-stroke" />
      <polygon points="${pHead} ${pL} ${pR}" fill="${this.arrowColor}" class="arrow-head-poly" />
    `;

    return g;
  }

  handleArrowTap(arrow) {
    if (this.isWon || this.isGameOver || arrow.state !== 'idle') return;

    this.moves++;
    const isFree = window.isArrowFreeToExit(arrow, this.arrows);

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

  // Slow, relaxing, smooth sliding exit with guaranteed termination
  executeSlowTrackSlidingEscape(arrow) {
    arrow.state = 'flying';
    const g = arrow.groupEl;
    const pathEl = arrow.pathEl;
    const headEl = arrow.headEl;
    if (!g || !pathEl || !headEl) return;

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

    // Glow highlight
    pathEl.setAttribute('stroke', this.activeColor);
    pathEl.setAttribute('stroke-width', (this.arrowStrokeWidth + 0.8).toString());
    pathEl.setAttribute('filter', 'url(#electric-glow)');
    headEl.setAttribute('fill', this.activeColor);
    headEl.setAttribute('filter', 'url(#electric-glow)');

    // Rail track extending off-board
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
    // Calibrated duration: slow & calm (~1500ms to 2400ms)
    const duration = Math.max(1400, Math.min(2600, (arrowLen + 350) * 3.2));

    const totalTravel = trackLen + 100;

    const animateSlither = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Steady velocity
      const ease = progress < 0.08
        ? 0.5 * Math.pow(progress / 0.08, 2) * 0.08
        : progress;

      const slideDist = ease * totalTravel;
      const dStart = slideDist;
      const dEnd = arrowLen + slideDist;

      // GUARANTEED TERMINATION: Once progress is 1 or tail has cleared the track, remove cleanly!
      if (progress >= 1 || dStart >= trackLen) {
        arrow.state = 'escaped';
        if (g.parentElement) g.parentElement.removeChild(g);
        this.checkWinCondition();
        this.notifyState();
        return;
      }

      const subPts = window.sampleTrackSubPolyline(track, dStart, dEnd);

      if (!subPts || subPts.length < 2) {
        arrow.state = 'escaped';
        if (g.parentElement) g.parentElement.removeChild(g);
        this.checkWinCondition();
        this.notifyState();
        return;
      }

      // Update path
      let pathD = `M ${subPts[0].x} ${subPts[0].y}`;
      for (let i = 1; i < subPts.length; i++) {
        pathD += ` L ${subPts[i].x} ${subPts[i].y}`;
      }
      pathEl.setAttribute('d', pathD);

      // Update arrowhead orientation
      const curHead = subPts[subPts.length - 1];
      const curPrev = subPts[subPts.length - 2];
      const segDx = curHead.x - curPrev.x;
      const segDy = curHead.y - curPrev.y;
      const segDist = Math.hypot(segDx, segDy);

      if (segDist > 0.1) {
        const uX = segDx / segDist;
        const uY = segDy / segDist;
        const tipLen = 10.5;
        const tipW = 5.5;
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

  // Bonk animation along the track
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

    const bonkColor = '#ef4444';
    pathEl.setAttribute('stroke', bonkColor);
    headEl.setAttribute('fill', bonkColor);

    const pts = arrow.points.map((p) => this.toPixel(p.x, p.y));
    const headPt = pts[pts.length - 1];
    const prevPt = pts[pts.length - 2];
    const dx = Math.sign(headPt.x - prevPt.x);
    const dy = Math.sign(headPt.y - prevPt.y);

    const track = [...pts, { x: headPt.x + dx * 28, y: headPt.y + dy * 28 }];
    const arrowLen = window.getPolylineLength(pts);

    const bonkStart = performance.now();
    const bonkDuration = 360;

    const animateBonk = (now) => {
      const elapsed = now - bonkStart;
      const t = Math.min(elapsed / bonkDuration, 1);

      const nudge = Math.sin(t * Math.PI) * 12;
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
        // Reset to idle
        let origD = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) origD += ` L ${pts[i].x} ${pts[i].y}`;
        pathEl.setAttribute('d', origD);
        pathEl.setAttribute('stroke', this.arrowColor);

        const tipLen = 10.5;
        const tipW = 5.5;
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
    if (this.hintsCount <= 0 || this.isWon || this.isGameOver) return;

    const freeArrow = this.arrows.find((a) => a.state === 'idle' && window.isArrowFreeToExit(a, this.arrows));
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
        difficulty: this.level ? this.level.difficulty : 'Normal',
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
