// @flow

const React = require('react');
const {Button, Canvas, Plot, plotReducer} = require('bens_ui_components');
const {useState, useMemo, useEffect, useReducer} = React;
const {initGrid, initEntities} = require('../state');
const {deepCopy} = require('bens_utils').helpers;
// const {mouseControlsSystem, mouseReducer} = require('bens_reducers');

import type {GameState} from '../types';

const WIDTH = 800;
const HEIGHT = 600;
const MONEY = 100;
const SEED = 0.01;
const NUM_BOULDERS = 8;
const TICK_MS = 500;
const MAX_CRYPTO = 100;

function Main(props: Props): React.Node {

  // game game
  const [game, dispatch] = useReducer(
    gameReducer,
    {},
    () => {
      const grid = initGrid(WIDTH, HEIGHT, SEED);
      return {
        time: 0,
        paused: false,
        money: MONEY,
        grid,
        entities: initEntities(grid, WIDTH, HEIGHT, NUM_BOULDERS),
      };
    },
  );

  // simulation
  useEffect(() => {
    if (game.paused) {
      return () => clearInterval(interval);
    }
    let interval = setInterval(() => {
      dispatch({type: 'STEP_SIMULATION'});
    }, TICK_MS)

    return () => clearInterval(interval);
  }, [game, game.paused, dispatch, TICK_MS]);

  // rendering
  useEffect(() => {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const {grid, entities} = game;
    if (!grid) return;

    // draw ground:
    ctx.fillStyle = '#FFEBCD';
    ctx.fillRect(0, 0, grid.width, grid.height);

    // draw crypto:
    for (let x = 0; x < grid.width; x++) {
      for (let y = 0; y < grid.height; y++) {
        const val = grid.getCell(grid, x, y);
        if (val > 0) {
          ctx.fillStyle = 'rgba(0, 50, 0, ' + val/MAX_CRYPTO + 20 + ')';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    // draw entities:
    for (let entityID in entities) {
      const entity = entities[entityID];
      if (entity.type == 'BOULDER') {
        ctx.fillStyle = 'gray';
        ctx.fillRect(entity.position.x, entity.position.y, entity.width, entity.height);
      }
    }
  }, [game, game.time]);

  // mouse game
  useEffect(() => {
  }, []);

  return (
    <div
      style={{

      }}
    >
      <div>
        Money: ${game.money}
      </div>
      <Canvas
        width={WIDTH}
        height={HEIGHT}
      />
      <Button
        label={game.paused ? 'Play' : 'Pause'}
        onClick={() => dispatch({type: 'PAUSE'})}
      />
    </div>
  );
}


const gameReducer = (game, action) => {
  switch (action.type) {
    case 'STEP_SIMULATION':
      game.time += 1;
      game = stepCrypto(game);

      return game;
    case 'PAUSE':
      return {
        ...game,
        paused: !game.paused,
      };
    case 'SPAWN_PERSON':
  }
  return game;
};


const stepCrypto = (game) => {
  // const nextGame = deepCopy(game);
  const nextGame = {...game};
  const {grid, entities} = nextGame;

  // const nextCells = [];
  for (let x = 0; x < grid.width; x++) {
    for (let y = 0; y < grid.height; y++) {
      const val = grid.getCell(grid, x, y);
      if (val > 0) {
        grid.setCell(grid, x, y, Math.min(MAX_CRYPTO, val + 1));
      } else if (val == 0) {
        let set = false;
        for (let xi = -1; xi <= 1; xi++) {
          if (set) break;
          for (let yi = -1; yi <= 1; yi++) {
            const neighborVal = grid.getCell(grid, x + xi, y + yi);
            if (neighborVal > 0 && Math.random() < neighborVal / MAX_CRYPTO) {
              grid.setCell(grid, x, y, 1);
              set = true;
               break;
            }
          }
        }
      }
    }
  }

  // grid.cells = nextCells;
  return nextGame;
};

module.exports = Main;
