class Controls {
  constructor(game) {
    this.game = game;
    this.init();
  }

  init() {
    document.addEventListener('keydown', (event) => this.onKeyDown(event));
  }

  onKeyDown(event) {
    if (event.code === 'KeyG') {
      this.game.studio.spawnSheepInFrontOfPlayer();
    }
  }
}

export default Controls;