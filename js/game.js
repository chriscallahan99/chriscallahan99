(() => {
  const ROUNDS = 10;
  const MAX_ROUND_POINTS = 1000;
  const EXACT_BONUS = 500;

  const FX = window.PricedFX;
  const el = (id) => document.getElementById(id);
  const intro = el('intro');
  const roundScreen = el('round');
  const gameover = el('gameover');
  const startBtn = el('start-btn');
  const nextBtn = el('next-btn');
  const restartBtn = el('restart-btn');
  const guessForm = el('guess-form');
  const guessInput = el('guess-input');
  const reveal = el('reveal');
  const roundIndicator = el('round-indicator');
  const scoreValue = el('score-value');
  const listingCard = el('listing-card');
  const listingImage = el('listing-image');
  const listingTitle = el('listing-title');
  const listingLocation = el('listing-location');
  const listingDescription = el('listing-description');
  const stampEl = el('stamp');
  const yourGuessEl = el('your-guess');
  const actualPriceEl = el('actual-price');
  const roundPointsEl = el('round-points');
  const revealVerdict = el('reveal-verdict');
  const finalScoreEl = el('final-score');
  const finalMaxEl = el('final-max');
  const finalGrade = el('final-grade');
  const finalBreakdown = el('final-breakdown');

  const state = {
    pool: [],
    rounds: [],
    index: 0,
    score: 0,
    history: [],
    phase: 'intro', // intro -> guessing -> revealing -> revealed -> done
  };

  // Bumped whenever a round changes, so a stale reveal sequence stops early.
  let revealToken = 0;

  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const scoreGuess = (guess, actual) => {
    if (!Number.isFinite(guess) || guess < 0) return { points: 0, verdict: 'Invalid guess.', bad: true };
    if (guess > actual) {
      return { points: 0, verdict: `You went over by ${fmt(guess - actual)}. Zero points.`, bad: true, over: true };
    }
    if (guess === actual) {
      return {
        points: MAX_ROUND_POINTS + EXACT_BONUS,
        verdict: `Exact! +${EXACT_BONUS} bonus.`,
        bad: false,
        exact: true,
      };
    }
    const error = (actual - guess) / actual;
    const points = Math.max(0, Math.round(MAX_ROUND_POINTS * (1 - error)));
    const off = actual - guess;
    return {
      points,
      verdict: `Under by ${fmt(off)} (${(error * 100).toFixed(1)}% off).`,
      bad: false,
    };
  };

  const stampFor = (result) => {
    if (result.over) return { text: 'OVERBID', tone: 'bad' };
    if (result.bad) return { text: 'NOPE', tone: 'bad' };
    if (result.exact) return { text: 'EXACT!', tone: 'gold' };
    if (result.points >= 900) return { text: 'NAILED IT', tone: 'good' };
    if (result.points >= 600) return { text: 'SOLD!', tone: 'good' };
    return { text: 'LOWBALL', tone: 'meh' };
  };

  const grade = (score, max) => {
    const pct = score / max;
    if (pct >= 0.9) return 'Price-guessing virtuoso. Bob Barker is watching.';
    if (pct >= 0.7) return 'Seasoned bargain hunter.';
    if (pct >= 0.5) return 'Respectable. You know a weird lamp when you see one.';
    if (pct >= 0.25) return 'You tried. The cursed clown appreciates it.';
    return 'Please stay off Marketplace for your own good.';
  };

  const showScreen = (name) => {
    intro.classList.toggle('hidden', name !== 'intro');
    roundScreen.classList.toggle('hidden', name !== 'round');
    gameover.classList.toggle('hidden', name !== 'gameover');
    document.body.classList.toggle('is-intro', name === 'intro');
  };

  const renderListing = (listing) => {
    revealToken++;
    state.phase = 'guessing';

    listingImage.src = listing.image;
    listingImage.alt = listing.title;
    listingTitle.textContent = listing.title;
    listingLocation.textContent = listing.location || '';
    listingDescription.textContent = listing.description || '';

    stampEl.className = 'stamp';
    stampEl.textContent = '';
    listingCard.classList.remove('shake', 'win');
    FX.replay(listingCard, 'deal');
    FX.replay(listingImage, 'develop');

    reveal.classList.add('hidden');
    reveal.classList.remove('done');
    guessForm.classList.remove('hidden');
    guessInput.value = '';
    guessInput.disabled = false;
    guessInput.focus({ preventScroll: true });
    roundIndicator.textContent = `Round ${state.index + 1} / ${state.rounds.length}`;
    scoreValue.textContent = state.score.toLocaleString('en-US');
  };

  const startGame = async () => {
    if (state.phase === 'starting') return;
    if (state.pool.length === 0) {
      alert('No listings loaded. Check that data/listings.json exists.');
      return;
    }
    const count = Math.min(ROUNDS, state.pool.length);
    state.rounds = shuffle(state.pool).slice(0, count);
    state.index = 0;
    state.score = 0;
    state.history = [];

    if (state.phase === 'intro') {
      state.phase = 'starting';
      FX.confetti.fromElement(startBtn, { count: 40, speed: 11, spread: 80 });
      await FX.leaveIntro();
    }
    showScreen('round');
    window.scrollTo({ top: 0 });
    renderListing(state.rounds[0]);
  };

  const handleGuess = async (e) => {
    e.preventDefault();
    if (state.phase !== 'guessing') return;
    const raw = guessInput.value.trim();
    if (raw === '') return;

    const listing = state.rounds[state.index];
    const guess = Number(raw);
    const result = scoreGuess(guess, listing.price);
    const prevScore = state.score;
    state.score += result.points;
    state.history.push({ listing, guess, ...result });
    state.phase = 'revealing';
    const token = revealToken;

    guessInput.disabled = true;
    guessForm.classList.add('hidden');
    yourGuessEl.textContent = fmt(guess);
    revealVerdict.textContent = '';
    roundPointsEl.textContent = '0';
    reveal.classList.remove('hidden');

    // Drumroll: spin the price reels, then slam the stamp down.
    await FX.rollPrice(actualPriceEl, listing.price);
    if (token !== revealToken) return;

    revealVerdict.textContent = result.verdict;
    revealVerdict.classList.toggle('bad', !!result.bad);
    revealVerdict.classList.toggle('good', !result.bad);

    const s = stampFor(result);
    FX.stamp(stampEl, s.text, s.tone);
    if (result.over || result.bad) {
      FX.replay(listingCard, 'shake');
    } else if (result.exact) {
      FX.replay(listingCard, 'win');
      FX.confetti.fromElement(stampEl, { count: 170, speed: 15, spread: 120 });
    } else if (result.points >= 900) {
      FX.replay(listingCard, 'win');
      FX.confetti.fromElement(stampEl, { count: 70, speed: 12, spread: 90 });
    }

    reveal.classList.add('done');
    reveal.scrollIntoView({ block: 'nearest', behavior: FX.calm() ? 'auto' : 'smooth' });
    state.phase = 'revealed';
    FX.countUp(roundPointsEl, result.points, { duration: 650 });
    if (result.points > 0) {
      FX.countUp(scoreValue, state.score, { from: prevScore, duration: 650 });
      FX.replay(scoreValue, 'bump');
    }
    nextBtn.focus({ preventScroll: true });
  };

  const nextRound = () => {
    if (state.phase !== 'revealed') return;
    state.index += 1;
    if (state.index >= state.rounds.length) {
      endGame();
      return;
    }
    renderListing(state.rounds[state.index]);
    window.scrollTo({ top: 0, behavior: FX.calm() ? 'auto' : 'smooth' });
  };

  const endGame = () => {
    revealToken++;
    state.phase = 'done';
    const max = state.rounds.length * MAX_ROUND_POINTS;
    finalMaxEl.textContent = max.toLocaleString('en-US');
    finalScoreEl.textContent = '0';
    finalGrade.textContent = grade(state.score, max);
    finalGrade.classList.remove('in');
    finalBreakdown.innerHTML = '';
    state.history.forEach((h, i) => {
      const li = document.createElement('li');
      li.style.setProperty('--d', i);
      const title = document.createElement('span');
      title.className = 'bd-title';
      title.textContent = `${i + 1}. ${h.listing.title}`;
      const pts = document.createElement('span');
      pts.className = 'bd-points' + (h.points === 0 ? ' zero' : '');
      pts.textContent = `${fmt(h.guess)} vs ${fmt(h.listing.price)} — ${h.points} pts`;
      li.append(title, pts);
      finalBreakdown.append(li);
    });
    showScreen('gameover');
    window.scrollTo({ top: 0 });
    restartBtn.focus({ preventScroll: true });

    FX.countUp(finalScoreEl, state.score, { duration: 1400 }).then(() => {
      finalGrade.classList.add('in');
      if (state.score / max >= 0.6) {
        FX.confetti.burst({ x: window.innerWidth * 0.2, y: window.innerHeight, angle: -70, spread: 30, count: 80, speed: 20 });
        FX.confetti.burst({ x: window.innerWidth * 0.8, y: window.innerHeight, angle: -110, spread: 30, count: 80, speed: 20 });
      }
    });
  };

  const loadListings = async () => {
    const res = await fetch('data/listings.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Failed to load listings: ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('listings.json is empty or malformed');
    }
    state.pool = data.filter((l) => l && typeof l.price === 'number' && l.image);
  };

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);
  nextBtn.addEventListener('click', nextRound);
  guessForm.addEventListener('submit', handleGuess);

  FX.playIntro();

  loadListings().catch((err) => {
    console.error(err);
    const note = document.createElement('p');
    note.className = 'fineprint';
    note.textContent = 'Could not load listings: ' + err.message;
    intro.querySelector('.intro-copy').append(note);
    startBtn.disabled = true;
  });
})();
