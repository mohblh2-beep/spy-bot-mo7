function getSpyCount(n) {
  if (n >= 3 && n <= 6) return 1;
  if (n >= 7 && n <= 9) return 2;
  if (n >= 10 && n <= 12) return 3;
  return 5;
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

module.exports = { getSpyCount, shuffle };