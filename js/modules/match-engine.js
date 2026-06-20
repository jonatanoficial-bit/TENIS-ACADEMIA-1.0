import { clamp, lerp } from '../core/utils.js';

const POINT_LABELS = ['0', '15', '30', '40'];

const defaultScore = () => ({
  sets: [],
  currentGames: { player: 0, opponent: 0 },
  currentPoints: { player: 0, opponent: 0 },
  setWins: { player: 0, opponent: 0 },
  tiebreak: false,
  server: 'player',
});

const createStats = () => ({
  aces: { player: 0, opponent: 0 },
  winners: { player: 0, opponent: 0 },
  unforced: { player: 0, opponent: 0 },
  longestRally: 0,
  totalPoints: { player: 0, opponent: 0 },
});

export class LiveMatchController {
  constructor(canvas, onComplete) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onComplete = onComplete;
    this.active = false;
    this.paused = false;
    this.matchData = null;
    this.score = defaultScore();
    this.stats = createStats();
    this.log = [];
    this.pointAnimation = null;
    this.lastFrame = 0;
    this.buffs = {
      motivate: 0,
      attack: 0,
      calm: 0,
      physioUsed: false,
    };
    this.handleResize = this.resizeCanvas.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.resizeCanvas();
    this.loop = this.loop.bind(this);
  }

  mount(matchData, player, opponent) {
    this.matchData = { matchData, player, opponent };
    this.score = defaultScore();
    this.stats = createStats();
    this.log = ['Partida pronta para começar.'];
    this.active = false;
    this.paused = false;
    this.pointAnimation = null;
    this.buffs = { motivate: 0, attack: 0, calm: 0, physioUsed: false };
    this.draw(0);
  }

  start() {
    if (!this.matchData) return;
    this.active = true;
    this.paused = false;
    requestAnimationFrame(this.loop);
  }

  pause() {
    this.paused = !this.paused;
    if (!this.paused) requestAnimationFrame(this.loop);
  }

  destroy() {
    this.active = false;
    window.removeEventListener('resize', this.handleResize);
  }

  applyAction(action) {
    if (!this.matchData) return 'Nenhuma partida ativa.';
    switch (action) {
      case 'motivate':
        this.buffs.motivate = 3;
        this.log.unshift('Banco: elevar energia e pressão positiva por 3 pontos.');
        break;
      case 'attack':
        this.buffs.attack = 2;
        this.log.unshift('Banco: assumir risco alto de devolução nos próximos 2 pontos.');
        break;
      case 'calm':
        this.buffs.calm = 3;
        this.log.unshift('Banco: reduzir erros e alongar rallies por 3 pontos.');
        break;
      case 'physio':
        if (this.buffs.physioUsed) {
          this.log.unshift('Atendimento médico já utilizado nesta partida.');
          break;
        }
        this.buffs.physioUsed = true;
        this.matchData.player.fitness = clamp(this.matchData.player.fitness + 8, 35, 100);
        this.matchData.player.stamina = clamp(this.matchData.player.stamina + 4, 30, 100);
        this.log.unshift('Atendimento do fisioterapeuta: fitness parcial restaurado.');
        break;
      default:
        break;
    }
    this.log = this.log.slice(0, 8);
  }


  getSnapshot() {
    return {
      active: this.active,
      paused: this.paused,
      score: this.score,
      log: this.log,
      stats: this.stats,
      queue: this.matchData?.matchData || null,
    };
  }

  resizeCanvas() {
    const parent = this.canvas.parentElement || this.canvas;
    const width = parent.clientWidth || 360;
    const height = Math.min(540, Math.max(420, width * 1.25));
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw(0);
  }

  loop(timestamp) {
    if (!this.active || this.paused) return;
    if (!this.lastFrame) this.lastFrame = timestamp;
    const delta = timestamp - this.lastFrame;
    this.lastFrame = timestamp;

    if (!this.pointAnimation) {
      this.pointAnimation = this.createPointAnimation();
    } else {
      this.pointAnimation.elapsed += delta;
      if (this.pointAnimation.elapsed >= this.pointAnimation.duration) {
        const outcome = this.pointAnimation.outcome;
        this.resolvePoint(outcome);
        this.pointAnimation = null;
      }
    }

    this.draw(delta);

    if (this.active) {
      requestAnimationFrame(this.loop);
    }
  }

  createPointAnimation() {
    const outcome = this.generatePointOutcome();
    const rallyLength = outcome.rallyLength;
    this.stats.longestRally = Math.max(this.stats.longestRally, rallyLength);
    return {
      elapsed: 0,
      duration: 850 + rallyLength * 95,
      outcome,
    };
  }

  generatePointOutcome() {
    const { player, opponent } = this.matchData;
    const server = this.score.server === 'player' ? player : opponent;
    const receiver = this.score.server === 'player' ? opponent : player;
    const serverIsPlayer = this.score.server === 'player';

    const playerRating =
      player.overall +
      player.serve * 0.12 +
      player.return * 0.14 +
      player.focus * 0.1 +
      (player.preferredSurface === this.matchData.matchData.surface ? 5 : 0) +
      (this.buffs.motivate ? 4 : 0) +
      (this.buffs.attack ? 3 : 0) +
      (this.buffs.calm ? 2 : 0) +
      (player.fitness - 70) * 0.18;

    const opponentRating =
      opponent.overall +
      opponent.serve * 0.12 +
      opponent.return * 0.14 +
      opponent.focus * 0.1 +
      (opponent.preferredSurface === this.matchData.matchData.surface ? 5 : 0) +
      (opponent.fitness - 70) * 0.16;

    const serveAdvantage = serverIsPlayer ? player.serve * 0.06 : -opponent.serve * 0.06;
    const attackRisk = this.buffs.attack ? 0.035 : 0;
    const calmSafety = this.buffs.calm ? 0.03 : 0;
    const chance = clamp(0.5 + (playerRating - opponentRating) / 95 + serveAdvantage / 45 - attackRisk + calmSafety, 0.16, 0.84);
    const playerWins = Math.random() < chance;
    const rallyLength = Math.max(2, Math.round(2 + Math.random() * 5 + (this.buffs.calm ? 2 : 0)));

    const aceChance = clamp((server.serve - receiver.return) / 220, 0.01, 0.18);
    const ace = Math.random() < aceChance;
    const errorChance = clamp((receiver.return - server.focus) / 220 + attackRisk, 0.03, 0.22);
    const unforced = !ace && Math.random() < errorChance;

    return {
      playerWins,
      rallyLength,
      ace,
      unforced,
      server: this.score.server,
    };
  }

  resolvePoint(outcome) {
    const winner = outcome.playerWins ? 'player' : 'opponent';
    const loser = winner === 'player' ? 'opponent' : 'player';
    this.stats.totalPoints[winner] += 1;

    if (outcome.ace) {
      this.stats.aces[outcome.server] += 1;
      this.log.unshift(`${outcome.server === 'player' ? this.matchData.player.name : this.matchData.opponent.name} confirmou um ace.`);
    } else if (outcome.unforced) {
      this.stats.unforced[loser] += 1;
      this.log.unshift(`${winner === 'player' ? this.matchData.player.name : this.matchData.opponent.name} forçou o erro do rival.`);
    } else {
      this.stats.winners[winner] += 1;
      this.log.unshift(`Rally de ${outcome.rallyLength} bolas decidido por ${winner === 'player' ? this.matchData.player.name : this.matchData.opponent.name}.`);
    }

    this.log = this.log.slice(0, 8);

    if (this.score.tiebreak) {
      this.score.currentPoints[winner] += 1;
      if (
        this.score.currentPoints[winner] >= 7 &&
        this.score.currentPoints[winner] - this.score.currentPoints[loser] >= 2
      ) {
        this.finishSet(winner, true);
      }
    } else {
      this.score.currentPoints[winner] += 1;
      if (this.hasGameWinner(winner)) {
        this.finishGame(winner);
      }
    }

    this.matchData.player.fitness = clamp(this.matchData.player.fitness - 0.35, 35, 100);
    this.matchData.opponent.fitness = clamp(this.matchData.opponent.fitness - 0.28, 35, 100);

    ['motivate', 'attack', 'calm'].forEach((buff) => {
      if (this.buffs[buff] > 0) this.buffs[buff] -= 1;
    });
  }

  hasGameWinner(side) {
    const p = this.score.currentPoints.player;
    const o = this.score.currentPoints.opponent;
    if (side === 'player') {
      return p >= 4 && p - o >= 2;
    }
    return o >= 4 && o - p >= 2;
  }

  finishGame(winner) {
    this.score.currentGames[winner] += 1;
    this.score.currentPoints = { player: 0, opponent: 0 };
    this.score.server = this.score.server === 'player' ? 'opponent' : 'player';

    const { player, opponent } = this.score.currentGames;
    if ((player >= 6 || opponent >= 6) && Math.abs(player - opponent) >= 2) {
      this.finishSet(winner, false);
      return;
    }

    if (player === 6 && opponent === 6) {
      this.score.tiebreak = true;
      this.log.unshift('Tie-break iniciado.');
    }
  }

  finishSet(winner, fromTiebreak) {
    this.score.sets.push({
      player: this.score.currentGames.player,
      opponent: this.score.currentGames.opponent,
      tiebreak: fromTiebreak,
    });
    this.score.setWins[winner] += 1;
    this.score.currentGames = { player: 0, opponent: 0 };
    this.score.currentPoints = { player: 0, opponent: 0 };
    this.score.tiebreak = false;

    if (this.score.setWins[winner] === 2) {
      this.finishMatch(winner);
    }
  }

  finishMatch(winner) {
    this.active = false;
    const scoreline = [
      ...this.score.sets.map((set) => `${set.player}-${set.opponent}`),
      this.score.currentGames.player || this.score.currentGames.opponent
        ? `${this.score.currentGames.player}-${this.score.currentGames.opponent}`
        : null,
    ]
      .filter(Boolean)
      .join('  ');

    this.onComplete?.({
      winner,
      scoreline,
      stats: this.stats,
    });
  }

  draw() {
    const ctx = this.ctx;
    const width = this.canvas.clientWidth || 360;
    const height = this.canvas.clientHeight || 480;
    const pad = 16;
    ctx.clearRect(0, 0, width, height);

    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#07111f');
    bg.addColorStop(1, '#081824');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const courtX = pad;
    const courtY = 56;
    const courtW = width - pad * 2;
    const courtH = height - 118;
    const courtGradient = ctx.createLinearGradient(courtX, courtY, courtX, courtY + courtH);
    courtGradient.addColorStop(0, '#123c5a');
    courtGradient.addColorStop(1, '#0d3048');
    ctx.fillStyle = courtGradient;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 2;
    roundRect(ctx, courtX, courtY, courtW, courtH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(courtX + courtW / 2, courtY + 24);
    ctx.lineTo(courtX + courtW / 2, courtY + courtH - 24);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(courtX + 30, courtY + courtH / 2);
    ctx.lineTo(courtX + courtW - 30, courtY + courtH / 2);
    ctx.stroke();

    ctx.strokeRect(courtX + 30, courtY + 24, courtW - 60, courtH - 48);
    ctx.strokeRect(courtX + 30, courtY + courtH * 0.25, courtW - 60, courtH * 0.5);

    const playerPos = { x: width / 2, y: courtY + courtH - 54 };
    const opponentPos = { x: width / 2, y: courtY + 54 };

    drawPlayer(ctx, opponentPos.x, opponentPos.y, 18, '#6ea8ff');
    drawPlayer(ctx, playerPos.x, playerPos.y, 18, '#ffd166');

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (this.matchData) {
      ctx.fillText(this.matchData.opponent.name, opponentPos.x, opponentPos.y - 26);
      ctx.fillText(this.matchData.player.name, playerPos.x, playerPos.y + 34);
    }

    const ball = this.getBallPosition(playerPos, opponentPos);
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#fef08a';
    ctx.fill();
    ctx.shadowBlur = 0;

    drawScoreBar(ctx, this.score, width, this.matchData);
  }

  getBallPosition(playerPos, opponentPos) {
    if (!this.pointAnimation) {
      return { x: playerPos.x, y: (playerPos.y + opponentPos.y) / 2 };
    }
    const progress = clamp(this.pointAnimation.elapsed / this.pointAnimation.duration, 0, 1);
    const swings = this.pointAnimation.outcome.rallyLength;
    const phase = progress * swings;
    const localT = phase % 1;
    const downwards = Math.floor(phase) % 2 === 0;
    const from = downwards ? opponentPos : playerPos;
    const to = downwards ? playerPos : opponentPos;
    const x = lerp(from.x - 48 + Math.sin(phase * 2.5) * 52, to.x + 48 - Math.sin(phase * 2.4) * 52, localT);
    const y = lerp(from.y, to.y, localT);
    return { x, y };
  }
}

function drawPlayer(ctx, x, y, radius, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawScoreBar(ctx, score, width, matchData) {
  ctx.fillStyle = 'rgba(4, 10, 18, 0.82)';
  roundRect(ctx, 14, 12, width - 28, 34, 14);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '700 13px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(matchData ? `${matchData.player.name} vs ${matchData.opponent.name}` : 'Match Center', 26, 33);

  ctx.textAlign = 'right';
  const pointLabelPlayer = getPointLabel(score.currentPoints.player, score.currentPoints.opponent, score.tiebreak);
  const pointLabelOpponent = getPointLabel(score.currentPoints.opponent, score.currentPoints.player, score.tiebreak);
  const sets = `${score.setWins.player}-${score.setWins.opponent} sets | ${score.currentGames.player}-${score.currentGames.opponent} games | ${pointLabelPlayer}-${pointLabelOpponent}`;
  ctx.fillText(sets, width - 24, 33);
}

function getPointLabel(points, otherPoints, tiebreak) {
  if (tiebreak) return String(points);
  if (points >= 3 && otherPoints >= 3) {
    if (points === otherPoints) return '40';
    if (points > otherPoints) return 'AD';
    return '40';
  }
  return POINT_LABELS[Math.min(points, 3)] || '40';
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
