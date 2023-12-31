import React from "react";
import ReactDOM from "react-dom";
import App from "./App2";
import store from "./store";
import { Provider } from "react-redux";

ReactDOM.render(
  <Provider store={store}>
    <App store={store}/>
  </Provider>,
  document.getElementById("root")
);