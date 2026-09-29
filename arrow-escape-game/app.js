/**
 * Arrow Escape - Application Controller (1000 Levels Engine)
 * Manages UI, Level Selector, Victory Celebration & Audio
 */

class AppController {
  constructor() {
    // 1. Particle Canvas Engine
    const canvas = document.getElementById('particles-canvas');
    this.particles = new ParticleEngine(canvas);

    // 2. Game Engine
    const container = document.querySelector('.board-container');
    this.game = new BentArrowGame(container, this.particles);

    // Current range tab in level selector
    this.currentRange = { start: 1, end: 50 };

    // Register Callbacks
    this.game.onStateChange = (state) => this.updateUI(state);
    this.game.onLevelWin = (levelNum) => this.showVictoryScreen(levelNum);
    this.game.onGameOver = () => this.showGameOverScreen();

    this.setupEventListeners();

    // Start with saved level (or Level 1)
    const savedLevel = parseInt(localStorage.getItem('arrow_current_level_num') || '1', 10);
    this.game.startLevel(savedLevel);
  }

  setupEventListeners() {
    // Prev Level button (‹)
    document.getElementById('nav-prev-btn').addEventListener('click', () => {
      this.game.prevLevel();
    });

    // Next Level button (›)
    document.getElementById('nav-next-btn').addEventListener('click', () => {
      this.game.nextLevel();
    });

    // Header Level Chip Click -> Open 1000 Level Selector
    document.getElementById('level-title-btn').addEventListener('click', () => {
      this.openLevelSelectModal();
    });

    // Bottom Grid Button (#) -> Open 1000 Level Selector
    document.getElementById('btn-levels').addEventListener('click', () => {
      this.openLevelSelectModal();
    });

    // Hint Button (💡)
    document.getElementById('btn-hint').addEventListener('click', () => {
      this.game.useHint();
    });

    // Settings Button (⚙️) -> Toggle Sound
    document.getElementById('nav-settings-btn').addEventListener('click', () => {
      if (window.sound) {
        const muted = window.sound.toggleMute();
        alert(muted ? 'Sound Muted 🔇' : 'Sound Enabled 🔊');
      }
    });

    // Close Level Selector Modal
    document.getElementById('modal-close-btn').addEventListener('click', () => {
      this.closeModal('level-select-modal');
    });

    // Quick Jump Go Button
    document.getElementById('jump-go-btn').addEventListener('click', () => {
      this.handleJumpLevel();
    });

    document.getElementById('jump-level-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleJumpLevel();
      }
    });

    // Range Filter Tabs
    document.querySelectorAll('.range-tab-btn').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.range-tab-btn').forEach((t) => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const start = parseInt(e.currentTarget.dataset.start, 10);
        const end = parseInt(e.currentTarget.dataset.end, 10);
        this.currentRange = { start, end };
        this.renderLevelsGrid(start, end);
      });
    });

    // Victory Screen: "New Game" / "Next Level" button
    document.getElementById('victory-newgame-btn').addEventListener('click', () => {
      this.hideVictoryScreen();
      this.game.nextLevel();
    });

    // Victory Screen: "Main" button -> Open Level Selector
    document.getElementById('victory-main-btn').addEventListener('click', () => {
      this.hideVictoryScreen();
      this.openLevelSelectModal();
    });

    // Game Over Retry
    document.getElementById('gameover-retry-btn').addEventListener('click', () => {
      this.closeModal('gameover-modal');
      this.game.initLevel(this.game.level);
    });
  }

  handleJumpLevel() {
    const input = document.getElementById('jump-level-input');
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 1000) {
      this.closeModal('level-select-modal');
      input.value = '';
      this.game.startLevel(val);
    }
  }

  updateUI(state) {
    // 1. Level Title
    document.getElementById('level-title-text').textContent = `Level ${state.levelIndex}`;

    // Save current level to localStorage
    localStorage.setItem('arrow_current_level_num', state.levelIndex.toString());

    // 2. Remaining arrows count
    document.getElementById('remaining-count').textContent = state.remainingArrows;

    // 3. Difficulty Pill
    const diffBadge = document.getElementById('difficulty-badge');
    diffBadge.textContent = state.difficulty;
    if (state.difficulty === 'Grandmaster') {
      diffBadge.style.color = '#7c3aed';
      diffBadge.style.borderColor = '#c4b5fd';
    } else if (state.difficulty === 'Very Hard' || state.difficulty === 'Hard') {
      diffBadge.style.color = '#ea580c';
      diffBadge.style.borderColor = '#fed7aa';
    } else {
      diffBadge.style.color = '#334155';
      diffBadge.style.borderColor = '#e2e8f0';
    }

    // 4. Hearts (Lives)
    const hearts = document.querySelectorAll('#hearts-container .heart-icon');
    hearts.forEach((h, idx) => {
      if (idx < state.lives) {
        h.classList.remove('lost');
      } else {
        h.classList.add('lost');
      }
    });

    // 5. Hint badge counter
    document.getElementById('hint-badge').textContent = state.hintsCount;
  }

  showVictoryScreen(levelNum) {
    const modal = document.getElementById('victory-modal');
    const blueprintSvg = document.getElementById('victory-blueprint-svg');

    // Render completed puzzle blueprint inside the white card
    this.renderBlueprintSVG(this.game.level, blueprintSvg);

    // Spawn falling confetti flakes
    this.createConfettiFlakes();

    modal.classList.add('active');
  }

  hideVictoryScreen() {
    const modal = document.getElementById('victory-modal');
    modal.classList.remove('active');
    // Remove temporary confetti flakes
    document.querySelectorAll('.confetti-flake').forEach((f) => f.remove());
  }

  // Renders the mini maze blueprint inside the victory card
  renderBlueprintSVG(level, svgEl) {
    if (!level || !svgEl) return;
    svgEl.innerHTML = '';

    const { cols, rows, arrows } = level;
    const padding = 16;
    const gap = 18;
    const width = (cols - 1) * gap + 2 * padding;
    const height = (rows - 1) * gap + 2 * padding;

    svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    arrows.forEach((arr) => {
      const pts = arr.points.map((p) => ({
        x: padding + p.x * gap,
        y: padding + p.y * gap
      }));

      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${pts[i].x} ${pts[i].y}`;
      }

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#131e3a');
      path.setAttribute('stroke-width', '2.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svgEl.appendChild(path);

      // Arrowhead
      const n = pts.length;
      const head = pts[n - 1];
      const prev = pts[n - 2];
      const dx = Math.sign(head.x - prev.x);
      const dy = Math.sign(head.y - prev.y);

      const tipLen = 7;
      const tipW = 4;
      const pHead = `${head.x},${head.y}`;
      const pL = `${head.x - dx * tipLen - dy * tipW},${head.y - dy * tipLen - dx * tipW}`;
      const pR = `${head.x - dx * tipLen + dy * tipW},${head.y - dy * tipLen + dx * tipW}`;

      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', `${pHead} ${pL} ${pR}`);
      poly.setAttribute('fill', '#131e3a');
      svgEl.appendChild(poly);
    });
  }

  createConfettiFlakes() {
    const colors = ['#ec4899', '#eab308', '#10b981', '#f97316', '#a855f7', '#ffffff', '#38bdf8'];
    const modal = document.getElementById('victory-modal');

    for (let i = 0; i < 40; i++) {
      const flake = document.createElement('div');
      flake.className = 'confetti-flake';
      flake.style.left = `${Math.random() * 100}%`;
      flake.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      flake.style.animationDuration = `${1.8 + Math.random() * 2}s`;
      flake.style.animationDelay = `${Math.random() * 1.5}s`;
      flake.style.width = `${6 + Math.random() * 6}px`;
      flake.style.height = `${10 + Math.random() * 8}px`;
      modal.appendChild(flake);
    }
  }

  showGameOverScreen() {
    const modal = document.getElementById('gameover-modal');
    modal.classList.add('active');
  }

  openLevelSelectModal() {
    // Select appropriate tab based on current level
    const lvl = this.game.currentLevel;
    let start = 1, end = 50;
    if (lvl > 500) { start = 501; end = 1000; }
    else if (lvl > 250) { start = 251; end = 500; }
    else if (lvl > 100) { start = 101; end = 250; }
    else if (lvl > 50) { start = 51; end = 100; }

    document.querySelectorAll('.range-tab-btn').forEach((btn) => {
      const bStart = parseInt(btn.dataset.start, 10);
      const bEnd = parseInt(btn.dataset.end, 10);
      if (bStart === start && bEnd === end) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.renderLevelsGrid(start, end);
    document.getElementById('level-select-modal').classList.add('active');
  }

  renderLevelsGrid(start, end) {
    const grid = document.getElementById('levels-scroll-grid');
    grid.innerHTML = '';

    const currentLvl = this.game.currentLevel;
    const completed = this.game.completedLevels || {};

    for (let i = start; i <= end; i++) {
      const chip = document.createElement('div');
      chip.className = 'level-chip';
      if (i === currentLvl) chip.classList.add('current');
      if (completed[i]) chip.classList.add('completed');

      chip.textContent = i;
      chip.addEventListener('click', () => {
        this.closeModal('level-select-modal');
        this.game.startLevel(i);
      });
      grid.appendChild(chip);
    }
  }

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
  }
}

// Boot application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
