// @flow

const React = require('react');
const {Button, Canvas, Plot, plotReducer} = require('bens_ui_components');
const {useState, useMemo, useEffect, useReducer} = React;
const {initGrid, initEntities} = require('../state');
const {deepCopy, throttle} = require('bens_utils').helpers;
const {dist, add, subtract} = require('bens_utils').vectors;
const {randomIn, weightedOneOf} = require('bens_utils').stochastic;
// const {mouseControlsSystem, mouseReducer} = require('bens_reducers');

import type {GameState} from '../types';

const WIDTH = 500;
const HEIGHT = 600;
const MONEY = 50;
const NUM_BOULDERS = 7;
const PERSON_RADIUS = 5;
const PERSON_SPAWN_RATE = 25;
const STEP_KILL_RATE = 0.5; // more like 1 - kill rate as the formula is next = val * kill

const SEED = 0.05;
const TICK_MS = 16;
const MAX_CRYPTO = 1000;

const AGG_CELL_SIZE = 10;
const AGG_WIDTH = WIDTH / AGG_CELL_SIZE;
const AGG_HEIGHT = HEIGHT / AGG_CELL_SIZE;

function Main(props: Props): React.Node {

  // game state
  const [game, dispatch] = useReducer(
    gameReducer,
    {},
    () => {
      const grid = initGrid(WIDTH, HEIGHT, SEED, true /* is random */);
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
      if (game.time % PERSON_SPAWN_RATE == 0) {
        dispatch({type: 'SPAWN_PERSON'});
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [game, game.time, game.paused, dispatch, TICK_MS]);

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
    const imgData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
    for (let x = 0; x < grid.width; x++) {
      for (let y = 0; y < grid.height; y++) {
        const val = grid.getCell(grid, x, y);
        if (val > 0) {
          setRGBA(
            imgData, x, y,
            {r: 0, g: 50, b: 0, a: Math.round(255 * val / (MAX_CRYPTO + 20))},
          );
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // draw entities:
    for (let entityID in entities) {
      const entity = entities[entityID];
      if (entity.type == 'BOULDER') {
        ctx.fillStyle = 'gray';
      } else if (entity.type == 'PERSON') {
        ctx.fillStyle = 'steelblue';
      }
      ctx.beginPath();
      ctx.arc(entity.position.x, entity.position.y, entity.radius, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fill();
    }
  }, [game, game.time]);

  // mouse effect
  const [mouseDown, setMouseDown] = useState(false);
  useEffect(() => {
    const click = (ev) => {
      if (!mouseDown) return;
      const pixel = getMousePixel(ev, 'canvas');
      if (pixel == null) return;
      dispatch({type: 'CLEAR_PATH', position: pixel, radius: 10});
    };
    document.onmousedown = () => setMouseDown(true);
    document.onmouseup = () => setMouseDown(false);
    if (mouseDown) {
      if (game.money <= 0) {
        setMouseDown(false);
        document.onmousemove = undefined;
        return;
      }
      document.onmousemove = click;
    } else {
      document.onmousemove = undefined;
    }
  }, [dispatch, setMouseDown, mouseDown, game.money]);

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
        label={"Spawn Person"}
        onClick={() => dispatch({type: 'SPAWN_PERSON'})}
      />
      <Button
        label={"Debug"}
        onClick={() => console.log(game)}
      />
    </div>
  );
}

////////////////////////////////////////////////////////////////////////
// Reducers
////////////////////////////////////////////////////////////////////////

const gameReducer = (game, action) => {
  switch (action.type) {
    case 'STEP_SIMULATION': {
      const {entities, grid} = game;
      game.time += 1;
      // grow crypto
      if (game.time % 10 == 0) {
        game = stepCrypto(game);
      }

      // re-compute shortest paths to boulders
      for (let entityID in entities) {
        const entity = entities[entityID];
        if (entity.type != 'BOULDER') continue;
        if (game.time % NUM_BOULDERS + 1 == entityID) {
          // console.log("recompute", game.time, entityID, entity);
          let start = Date.now();
          computeBoulderPaths(game, entity);
          // console.log('recompute dur', game.time, entityID, Date.now() - start);
        }
      }

      // step people
      for (let entityID in entities) {
        const entity = entities[entityID];
        if (entity.type != 'PERSON') continue;
        const possibleMoves = getNeighborPositions(
          entity.destination.paths, getAggPos(entity.position),
        );
        let bestMove = entity.position;
        let bestScore = Infinity;
        for (const move of possibleMoves) {
          const thisScore = entity.destination.paths.getCell(
            entity.destination.paths, move.x, move.y,
          );
          if (thisScore != null && thisScore < bestScore) {
            bestMove = move;
            bestScore = thisScore;
          } else if (thisScore != null && thisScore == bestScore && Math.random() < 0.5) {
            bestMove = move; // so you don't always go top left
          } else if (thisScore != null && Math.random() < 1/(10 * (thisScore - bestScore))) {
            bestMove = move; // so you don't always go top left
          }
        }
        // do the move, based on aggregate:
        const aggPos = getAggPos(entity.position);
        const delta = subtract(bestMove, aggPos);
        // console.log(aggPos, bestMove, delta, bestScore);
        entity.position = add(entity.position, delta);
        // destroy crypto
        const {x, y} = entity.position;
        for (let i = x - entity.radius; i < x + entity.radius; i++) {
          for (let j = y - entity.radius; j < y + entity.radius; j++) {
            if (dist({x: i, y: j}, entity.position) <= entity.radius) {
              grid.setCell(grid, i, j, Math.max(0, grid.getCell(grid, i, j) * STEP_KILL_RATE));
            }
          }
        }

      }

      return game;
    }
    case 'PAUSE':
      return {
        ...game,
        paused: !game.paused,
      };
    case 'SPAWN_PERSON': {
      const {entities} = game;
      let maxID = 0;
      const boulders = [];
      const boulderPopularities = [];
      for (let id in entities) {
        const entityID = parseInt(id);
        if (entityID > maxID) maxID = entityID;
        const entity = entities[entityID];
        if (entity.type == 'BOULDER') {
          boulders.push(entity);
          boulderPopularities.push(entity.popularity);
        }
      }
      const person = {
        type: 'PERSON',
        id: maxID + 1,
        radius: PERSON_RADIUS,
        position: {x: randomIn(5, WIDTH - 5), y: HEIGHT - 5},
        destination: weightedOneOf(boulders, boulderPopularities),
      }
      game.entities[maxID + 1] = person;
      game.money += 1;
      return game;
    }
    case 'CLEAR_PATH': {
      const {position, radius} = action;
      const {grid} = game;
      const {x, y} = position;
      if (game.money <= 0) return game; // prevent use if you can't afford it

      for (let i = x - radius; i < x + radius; i++) {
        for (let j = y - radius; j < y + radius; j++) {
          if (dist({x: i, y: j}, position) <= radius) {
            grid.setCell(grid, i, j, 0);
          }
        }
      }
      game.money -= 1;
      return game;
    }
  }
  return game;
};

////////////////////////////////////////////////////////////////////////
// Simulation
////////////////////////////////////////////////////////////////////////

const stepCrypto = (game) => {
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

////////////////////////////////////////////////////////////////////////
// A*
////////////////////////////////////////////////////////////////////////

const computeBoulderPaths = (game, boulder) => {
  const {grid} = game;
  const aggGrid = makeBoulderAggregate(game, boulder);
  boulder.paths = initGrid(AGG_WIDTH, AGG_HEIGHT, 10000000);
  const boulderAggPos = getAggPos(boulder.position);
  boulder.paths.setCell(boulder.paths, boulderAggPos.x, boulderAggPos.y, 0);
  const cellQueue = [...getNeighborPositions(boulder.paths, boulderAggPos)];
  while (cellQueue.length > 0) {
    let scoreChanged = false;
    const cell = cellQueue.pop();
    let score = boulder.paths.getCell(boulder.paths, cell.x, cell.y);

    // Need to handle if your position is -1, ie you're a boulder
    // BUT there's a difference between being this boulder and being some
    // other boulder
    if (
      aggGrid.getCell(aggGrid, cell.x, cell.y) < 0 &&
      dist(boulderAggPos, cell) > boulder.radius / AGG_CELL_SIZE
    ) {
      score = Infinity;
      continue;
    }

    // your score is the smallest of your neighbors + your crypto value + 1
    let minScore = Infinity;
    for (const neighbor of getNeighborPositions(aggGrid, cell)) {
      const val = boulder.paths.getCell(boulder.paths, neighbor.x, neighbor.y);
      if (val < minScore) {
        minScore = val;
      }
    }
    const cryptoVal = Math.max(0, aggGrid.getCell(aggGrid, cell.x, cell.y));
    minScore += cryptoVal/MAX_CRYPTO + 1;
    if ((score == 0 && minScore != score) || minScore < score) {
      score = minScore;
      boulder.paths.setCell(boulder.paths, cell.x, cell.y, score);
      scoreChanged = true;
    }

    // console.log(cell, score, scoreChanged);

    // if your score changed, then add your neighbors to the queue if their
    // score could improve
    if (scoreChanged) {
      for (const neighbor of getNeighborPositions(aggGrid, cell)) {
        const neighborVal = boulder.paths.getCell(boulder.paths, neighbor.x, neighbor.y);
        if (neighborVal >= score && neighborVal != Infinity) {
          cellQueue.unshift(neighbor);
        }
      }
    }

  }
}

const makeBoulderAggregate = (game, boulder) => {
  const aggregate = initGrid(AGG_WIDTH, AGG_HEIGHT, 0);
  for (let i = 0; i < AGG_WIDTH; i++) {
    for (let j = 0; j < AGG_HEIGHT; j++) {
      let cellSum = 0;
      for (let x = 0; x < AGG_CELL_SIZE; x++) {
        for (let y = 0; y < AGG_CELL_SIZE; y++) {
          cellSum += game.grid.getCell(
            game.grid, i * AGG_CELL_SIZE + x, j * AGG_CELL_SIZE + y,
          );
        }
      }
      aggregate.setCell(aggregate, i, j, cellSum);
    }
  }
  return aggregate;
}
// convert from game grid position to aggregate grid position
const getAggPos = (pos) => {
  const aggX = Math.floor(pos.x / AGG_CELL_SIZE);
  const aggY = Math.floor(pos.y / AGG_CELL_SIZE);
  return {x: aggX, y: aggY};
}

////////////////////////////////////////////////////////////////////////
// Grid helpers
////////////////////////////////////////////////////////////////////////

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

////////////////////////////////////////////////////////////////////////
// Mouse
////////////////////////////////////////////////////////////////////////
const getMousePixel = (ev, canvasID): ?Vector => {
  const canvas = document.getElementById(canvasID);
  if (!canvas) return null;
  const canvasDims = canvas.getBoundingClientRect();
  let x = ev.clientX;
  let y = ev.clientY;
  if (
    ev.type === 'touchstart' || ev.type === 'touchmove' || ev.type === 'touchend'
  ) {
    const touch = ev.touches[0];
    x = touch.clientX;
    y = touch.clientY;
  }
  const canvasPos = {
    x: x - canvasDims.left,
    y: y - canvasDims.top,
  };
  const {width: canvasWidth, height: canvasHeight} = canvasDims;
  // return null if clicked outside the canvas:
  if (
    canvasPos.x < 0 || canvasPos.y < 0 ||
    canvasPos.x > canvasWidth || canvasPos.y > canvasHeight
  ) {
    return null;
  }
  return canvasPos;
};

////////////////////////////////////////////////////////////////////////
// Rendering
////////////////////////////////////////////////////////////////////////

const getRGBA = (imgData, x, y) => {
  const pixel = 4 * y * imgData.width + 4 * x;
  return {
    r: imgData[pixel],
    g: imgData[pixel + 1],
    b: imgData[pixel + 2],
    a: imgData[pixel + 3],
  };
}

const setRGBA = (imgData, x, y, rgba) => {
  const pixel = 4 * y * imgData.width + 4 * x;
  imgData.data[pixel] = rgba.r;
  imgData.data[pixel + 1] = rgba.g;
  imgData.data[pixel + 2] = rgba.b;
  rgba.a !== undefined
    ? imgData.data[pixel + 3] = rgba.a
    : imgData.data[pixel + 3] = 255;
};

module.exports = Main;
