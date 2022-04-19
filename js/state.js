
const {randomIn} = require('bens_utils').stochastic;

const initGrid = (width, height, seed) => {
  const cells = [];
  for (let x = 0; x < width; x++) {
    const row = [];
    for (let y = 0; y < height; y++) {
      let val = 0;
      if (Math.random() < seed) {
        val = randomIn(0, 5);
      }
      row.push(val);
    }
    cells.push(row);
  }

  return {
    cells,
    width,
    height,
    getCell: (grid, x, y) => {
      if (x < grid.width && y < grid.height && x >= 0 && y >= 0) {
        return grid.cells[x][y];
      }
      return null;
    },
    setCell: (grid, x, y, value) => {
      if (grid.getCell(grid, x, y) !== null) {
        grid.cells[x][y] = value;
      }
    },
    // clears an area:
    insertShape: (grid, shape) => {
      const {x, y} = shape.position;
      for (let i = x; i < x + shape.width; i++) {
        for (let j = y; j < y + shape.height; j++) {
          grid.setCell(grid, i, j, -1);
        }
      }
    },
  };
};

const initEntities = (grid, width, height, numBoulders) => {
  let entityID = 0;
  const entities = {};
  for (let i = 0; i < numBoulders; i++) {
    const boulderWidth = randomIn(10, 80);
    const boulderHeight = randomIn(10, 80);
    const boulder = {
      id: entityID++,
      type: 'BOULDER',
      position: {
        x: randomIn(0, width - boulderWidth),
        y: randomIn(0, height- boulderHeight),
      },
      width: boulderWidth,
      height: boulderHeight,
      popularity: randomIn(0, 100),
    };
    grid.insertShape(grid, boulder);
    entities[boulder.id] = boulder;
  }
  return entities;
};

module.exports = {
  initGrid,
  initEntities,
};
