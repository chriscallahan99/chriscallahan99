(() => {
  const ROUNDS = 10;
  const MAX_ROUND_POINTS = 1000;
  const EXACT_BONUS = 500;

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
  const scoreIndicator = el('score-indicator');
  const listingImage = el('listing-image');
  const listingTitle = el('listing-title');
  const listingLocation = el('listing-location');
  const listingDescription = el('listing-description');
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
  };

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
    if (guess > actual) return { points: 0, verdict: `You went over by ${fmt(guess - actual)}. Zero points.`, bad: true };
    if (guess === actual) {
      return {
        points: MAX_ROUND_POINTS + EXACT_BONUS,
        verdict: `Exact! +${EXACT_BONUS} bonus.`,
        bad: false,
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
  };

  const renderListing = (listing) => {
    listingImage.src = listing.image;
    listingImage.alt = listing.title;
    listingTitle.textContent = listing.title;
    listingLocation.textContent = listing.location || '';
    listingDescription.textContent = listing.description || '';
    reveal.classList.add('hidden');
    guessForm.classList.remove('hidden');
    guessInput.value = '';
    guessInput.disabled = false;
    guessInput.focus();
    roundIndicator.textContent = `Round ${state.index + 1} / ${state.rounds.length}`;
    scoreIndicator.textContent = `Score: ${state.score.toLocaleString('en-US')}`;
  };

  const startGame = () => {
    if (state.pool.length === 0) {
      alert('No listings loaded. Check that data/listings.json exists.');
      return;
    }
    const count = Math.min(ROUNDS, state.pool.length);
    state.rounds = shuffle(state.pool).slice(0, count);
    state.index = 0;
    state.score = 0;
    state.history = [];
    showScreen('round');
    renderListing(state.rounds[0]);
  };

  const handleGuess = (e) => {
    e.preventDefault();
    const listing = state.rounds[state.index];
    const raw = guessInput.value.trim();
    if (raw === '') return;
    const guess = Number(raw);
    const result = scoreGuess(guess, listing.price);
    state.score += result.points;
    state.history.push({ listing, guess, ...result });

    actualPriceEl.textContent = fmt(listing.price);
    roundPointsEl.textContent = result.points.toLocaleString('en-US');
    revealVerdict.textContent = result.verdict;
    revealVerdict.classList.toggle('bad', !!result.bad);
    revealVerdict.classList.toggle('good', !result.bad);
    scoreIndicator.textContent = `Score: ${state.score.toLocaleString('en-US')}`;
    guessInput.disabled = true;
    guessForm.classList.add('hidden');
    reveal.classList.remove('hidden');
    nextBtn.focus();
  };

  const nextRound = () => {
    state.index += 1;
    if (state.index >= state.rounds.length) {
      endGame();
      return;
    }
    renderListing(state.rounds[state.index]);
  };

  const endGame = () => {
    const max = state.rounds.length * MAX_ROUND_POINTS;
    finalScoreEl.textContent = state.score.toLocaleString('en-US');
    finalMaxEl.textContent = max.toLocaleString('en-US');
    finalGrade.textContent = grade(state.score, max);
    finalBreakdown.innerHTML = '';
    state.history.forEach((h, i) => {
      const li = document.createElement('li');
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
    restartBtn.focus();
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

  loadListings().catch((err) => {
    console.error(err);
    const note = document.createElement('p');
    note.className = 'fineprint';
    note.textContent = 'Could not load listings: ' + err.message;
    intro.append(note);
    startBtn.disabled = true;
  });
})();
