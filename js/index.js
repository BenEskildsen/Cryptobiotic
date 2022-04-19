// @flow

const {createStore} = require('redux');
const Main = require('./ui/Main.react');
const React = require('react');
const ReactDOM = require('react-dom');
// const {rootReducer} = require('./reducers/rootReducer');

// import type {Store} from './types';

// const store = createStore(rootReducer);
// window.store = store; // useful for debugging and a few hacks

// subscribe the game rendering to the store
// renderUI(store);
// store.subscribe(() => {
//   renderUI(store);
// });


function renderUI(): React.Node {
  ReactDOM.render(
    <Main />,
    document.getElementById('container'),
  );
}

renderUI();

