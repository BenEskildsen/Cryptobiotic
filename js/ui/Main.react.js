// @flow

const React = require('react');
const {Button, Canvas, Plot, plotReducer} = require('bens_ui_components');
const {useState, useMemo, useEffect, useReducer} = React;
const {initGrid, initEntities} = require('../state');
const {deepCopy} = require('bens_utils').helpers;
const {dist} = require('bens_utils').vectors;
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
        ctx.beginPath();
        ctx.arc(entity.position.x, entity.position.y, entity.radius, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
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
      <Button
        label={"Debug"}
        onClick={() => console.log(game)}
      />
    </div>
  );
}


const gameReducer = (game, action) => {
  switch (action.type) {
    case 'STEP_SIMULATION': {
      const {entities} = game;
      game.time += 1;
      // grow crypto
      game = stepCrypto(game);

      // re-compute shortest paths to boulders
      for (let entityID in entities) {
        const entity = entities[entityID];
        if (entity.type != 'BOULDER') continue;
        if (game.time % entityID == 0) {
          computeBoulderPaths(game, entity);
        }
      }

      return game;
    }
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
        for (let i = -1; i <= 1; i++) {
          if (set) break;
          for (let j = -1; j <= 1; j++) {
            const neighborVal = grid.getCell(grid, x + i, y + j);
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

const computeBoulderPaths = (game, boulder) => {
  const {grid} = game;
  const cellQueue = [boulder.position];
  boulder.paths = initGrid(grid.width, grid.height, 0);
  while (cellQueue.length > 0) {
    let scoreChanged = false;
    const cell = cellQueue.pop();
    let score = boulder.paths.getCell(boulder.paths, cell.x, cell.y);

    // Need to handle if your position is -1, ie you're a boulder
    // BUT there's a difference between being this boulder and being some
    // other boulder
    if (
      grid.getCell(grid, cell.x, cell.y) == -1 &&
      dist(boulder.position, cell) > boulder.radius
    ) {
      score = Infinity;
      continue;
    }

    // your score is the smallest of your neighbors + your crypto value + 1
    let minScore = Infinity;
    for (const neighbor of getNeighborPositions(grid, cell)) {
      const val = boulder.paths.getCell(boulder.paths, neighbor.x, neighbor.y);
      if (val < minScore) {
        minScore = val;
      }
    }
    const cryptoVal = Math.max(0, grid.getCell(grid, cell.x, cell.y));
    minScore += cryptoVal + 1;
    if ((score == 0 && minScore != score) || minScore < score) {
      score = minScore;
      boulder.paths.setCell(boulder.paths, cell.x, cell.y, score);
      scoreChanged = true;
    }

    // if your score changed, then add your neighbors to the queue if their
    // score could improve
    if (scoreChanged) {
      for (const neighbor of getNeighborPositions(grid, cell)) {
        const neighborVal = boulder.paths.getCell(boulder.paths, neighbor.x, neighbor.y);
        if (neighborVal >= score && neighborVal != Infinity) {
          cellQueue.push(neighbor);
        }
      }
    }

  }
}

const getNeighborPositions = (grid, pos) => {
  const neighbors = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i == 0 && j == 0) continue;
      if (grid.getCell(grid, pos.x + i, pos.y + j) == null) continue;
      neighbors.push({x: pos.x + i, y: pos.y + j});
    }
  }
  return neighbors;
};

module.exports = Main;
