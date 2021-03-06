// @flow

export type Vector = {x: number, y: number};
export type EntityID = number;
export type Crypto = number;

export type Shape = {
  id: EntityID,
  position: Vector,
  radius: number,
};

export type Grid = {
  cells: Array<Array<number>>,
  width: number,
  height: number,
  getCell: (grid: Grid, x, y) => ?number,
  setCell: (grid: Grid, x, y, val) => void,
  insertShape: (shape: Shape) => void,
};

export type Boulder = Shape & {
  type: 'BOULDER',
  popularity: number,
  paths: Grid, // A* grid of shortest paths from every cell to the boulder
};

export type Person = Shape & {
  type: 'PERSON',
  destination: Boulder, // could be a position, but boulder knows the paths to it
};

export type Entity = Person | Boulder;

export type GameState = {
  time: number,
  money: number,
  grid: Array<Array<Crypto>>,
  entities: {[EntityID]: Entity},
};
