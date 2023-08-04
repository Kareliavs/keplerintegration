/* global fetch */
import React, {useMemo, useState, Component} from 'react';
import {createRoot} from 'react-dom/client';
import {Map} from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import DeckGL from '@deck.gl/react';
import {ScatterplotLayer, ArcLayer} from '@deck.gl/layers';
import {BrushingExtension} from '@deck.gl/extensions';
import {scaleLinear} from 'd3-scale';
import CanvasJSReact from '@canvasjs/react-charts';
import {useRef, useEffect,useCallback } from 'react';
// import {SidebarFactory} from 'kepler.gl/components';
// import KeplerGl from "kepler.gl"

import keplerGlReducer from 'kepler.gl/reducers';
import { legacy_createStore as createStore} from 'redux'
import { combineReducers, applyMiddleware } from "redux";
import { taskMiddleware } from "react-palm/tasks";
import { Provider, useDispatch } from "react-redux";
import KeplerGl from "kepler.gl";
import { addDataToMap } from "kepler.gl/actions";
import useSwr from "swr";
const reducers = combineReducers({
  keplerGl: keplerGlReducer
});

const store = createStore(reducers, {}, applyMiddleware(taskMiddleware));


// import {LOCALE_CODES} from 'kepler.gl/localization';

// const customizedKeplerGlReducer = keplerGlReducer.initialState({
//   uiState: {
//     // use Finnish locale
//     locale: LOCALE_CODES.en
//   }
// });

import {DataFilterExtension} from '@deck.gl/extensions';
import {MapView} from '@deck.gl/core';
//import RangeInput from './range-input';
const MS_PER_DAY = 8.64e7; //Miliseconds per day
// Source data GeoJSON
//const DATA_URL ='./NY_2015_latlong.json'; // eslint-disable-line
//import data from './NY_2015_latlong.json';
export const inFlowColors = [[35, 181, 184]];
export const outFlowColors = [[184, 10, 184]];

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;

// migrate out
const SOURCE_COLOR = [166, 3, 3];
// migrate in
const TARGET_COLOR = [35, 181, 184];

const INITIAL_VIEW_STATE = {
  longitude: -73.9624876113855,
  latitude: 40.77123044666521,
  zoom: 13,
  maxZoom: 25,
  pitch: 0,
  bearing: 0
};
//https://deck.gl/docs/api-reference/carto/basemap
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const brushingExtension = new BrushingExtension();
// KARELIA
    
    const dataFilter = new DataFilterExtension({
      filterSize: 1,
      // Enable for higher precision, e.g. 1 second granularity 
      // See DataFilterExtension documentation for how to pick precision
      fp64: false
    });
    //LOAD DATA  https://stackblitz.com/edit/github-cjzayy-4zdvla?file=main.js
    
    import * as duckdb from '@duckdb/duckdb-wasm';
    import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
    import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
    import duckdb_wasm_next from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
    import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

    const MANUAL_BUNDLES = {
      mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
      },
      eh: {
        mainModule: duckdb_wasm_next,
        // mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js', import.meta.url).toString(),
        mainWorker: eh_worker,
      },
    };

    // Select a bundle based on browser checks
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

    // Instantiate the asynchronus version of DuckDB-wasm
    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    const conn = await db.connect(); // Connect to db

    // Basic query
    const file = await fetch('./data/2009-01_medium_big.parquet');
    const query = "CREATE TABLE direct AS SELECT * FROM '"+file.url+"'";
    let q = await conn.query(query); // Returns v = 101
    const stmt = await conn.prepare(`SELECT * FROM direct;`);
    const res = await stmt.query(); 
    console.log('NO MORI');
    const data =  JSON.parse(
        JSON.stringify(
          res.toArray(),
          (key, value) => (typeof value === 'bigint' ? value.toString() : value) // return everything else unchanged
        )
      );

    // Closing everything
     await conn.close();
     await db.terminate();
     await worker.terminate();
     console.log('Finished!');

    //LOADED DATA


    const quadtree = d3.quadtree(); 
    const k=500;
    let mouse_lat,mouse_lng;
    let findedradius;
    //This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
    function calcCrow(lat1, lon1, lat2, lon2) 
    {
      var R = 6371; // km
      var dLat = toRad(lat2-lat1);
      var dLon = toRad(lon2-lon1);
      var lat1 = toRad(lat1);
      var lat2 = toRad(lat2);

      var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      var d = R * c;
      return d;
    }

    // Converts numeric degrees to radians
    function toRad(Value) 
    {
        return Value * Math.PI / 180;
    }

    function euclidDistance(x1, y1, x2, y2){
      return Math.pow(x1-x2, 2) + Math.pow(y1-y2, 2);
    }

    function mindist(x, y, x1, y1, x2, y2){
      var dx1 = x - x1, dx2 = x - x2, 
          dy1 = y - y1, dy2 = y - y2;

      if (dx1*dx2 < 0) { // x is between x1 and x2
        if (dy1*dy2 < 0) { // (x,y) is inside the rectangle
          return 0; // return 0 as point is in rect
        }
        return Math.min(Math.pow(Math.abs(dy1),2),Math.pow(Math.abs(dy2),2));
      }
      if (dy1*dy2 < 0) { // y is between y1 and y2
        // we don't have to test for being inside the rectangle, it's already tested.
        return Math.min(Math.pow(Math.abs(dx1),2),Math.pow(Math.abs(dx2),2));
      }
      return Math.min( Math.min(euclidDistance(x,y,x1,y1),euclidDistance(x,y,x2,y2)), Math.min(euclidDistance(x,y,x1,y2),euclidDistance(x,y,x2,y1)) );
    }

    function knearest(bestqueue, resultqueue, x, y, k) { 
      
      bestqueue.sort(function(a, b){ // sort children according to their mindist/dist to searchpoint
        [a, b].forEach(function(val){
          if(val.mindist == undefined){ // add minidst to nodes if not there already
            if(!val.length){ // is leaf
              val.mindist = euclidDistance(x, y, val.data[0], val.data[1]);
            }else{
              val.mindist = mindist(x, y, val.x1, val.y1, val.x2, val.y2);
            }
          }
        });
        return b.mindist - a.mindist;
      });

      for (var i=bestqueue.length-1; i>=0; i--){ // add nearest leafs if any
        var elem = bestqueue[i];
        if(!elem.length){ // is leaf
          bestqueue.pop();
          resultqueue.push(elem);
          if(resultqueue.length >=k || bestqueue.length == 0){ // return if k neighbors found or no points left
            return; 
          }
        }else{
          break;
        }
      }

      var visited = bestqueue.pop();
      for (var i=0; i<visited.length; i++) { // add child quadrants to queue
        if(visited[i]) {
          visited[i].mindist = undefined; // reset before adding it to the queue
          bestqueue.push(visited[i]);
        }
      }
      
      knearest(bestqueue, resultqueue, x, y, k); // recursion
    }

    // collapses a quadtree into a list of nodes, adding their depth
    function retrieveNodesAndDepth(quadtree) {
        const nodes = [];
        let maxdepth = 0;
        quadtree.root().depth = 0; // root node depth
        quadtree.visit((node, x1, y1, x2, y2) => {
        node.x1 = x1;
        node.y1 = y1;
        node.x2 = x2;
        node.y2 = y2;
        nodes.push(node);
        for (var i=0; i < node.length; i++) {
        if (node[i]) {
            node[i].depth = node.depth+1; 
            maxdepth = (node[i].depth > maxdepth) ? node[i].depth : maxdepth;
        }
        }
        return false;
    });
    return {"nodes": nodes, "depth": maxdepth};
    }
    
    function findradius(quadtree) {

      //let radius = (Math.floor(Math.random() * 5) + 1)*100000;
      const x=mouse_lat, y=mouse_lng;
      //get nearest neighbuors
      if(typeof quadtree.root() == 'undefined')
      { 
        return 0;
      }
      quadtree.root().mindist = 0;
      const bestqueue = new Array(quadtree.root()); // start with the root node of the quadtree
      const resultqueue = []; 
      knearest(bestqueue, resultqueue, x, y, k);
      const dist = calcCrow(x, y, resultqueue[k-1].data[0], resultqueue[k-1].data[1])*1000; //km*1000=m
      return dist;///ENCONTRAR EL RADIO Y VER SI AFECTA NODOS O ARISTAS
      } 
      function onlyUnique(value, index, array) {
        console.log(value);
        return array.indexOf(value) === index;
      }
//HASTA AQUI KARELIA

/* eslint-disable  max-nested-callbacks */
function getLayerData() {
  if (!data || !data.length) {
    return {};
  }
  const arcs = [];
  const targets = [];
  const sources = [];
  const pairs = {};
  let bigArray=[];
  data.forEach((viaje) => {
    //bigArray.push([viaje.pickup_longitude,viaje.pickup_latitude,viaje.dropoff_longitude,viaje.dropoff_latitude]);
    bigArray.push([viaje.Start_Lon,viaje.Start_Lat,viaje.End_Lon,viaje.End_Lat]);
  });
  let uniqueArray = Array.from(new Set(bigArray.map(JSON.stringify)), JSON.parse);
  console.log(bigArray.length,"-",uniqueArray.length,"=",bigArray.length-uniqueArray.length );
  uniqueArray.forEach((viaje) => {
    sources.push({
        position: [viaje[0],viaje[1],0],//pickup lng lat
        target: [viaje[2],viaje[3],0],//dropoff lng lat
        name: viaje,//viaje.VendorID,
        radius: 100,
        gain: 1
      });
    arcs.push({
        target: [viaje[2],viaje[3],0],//dropoff lng lat
        source: [viaje[0],viaje[1],0],//pickup lng lat
        value: viaje,//viaje.trip_distance
      });
    targets.push({
        position: [viaje[2],viaje[3],0],//dropoff lng lat
        net:1,
        name: viaje,//viaje.VendorID
      });

    quadtree.add([viaje[1],viaje[0]]); //KARELIA fill tree  //pickup  lat lng
  });

  const {nodes, depth} = retrieveNodesAndDepth(quadtree);//KARELIA
  return {arcs, targets, sources};
}
function formatLabel(t) {
  const date = new Date(t);
  return `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}`;
}
function getTimeRange() {
  if (!data) {
    return null;
  }
  return data.reduce(
    (range, d) => {
      const t = Date.parse(d.Trip_Dropoff_DateTime);
      range[0] = Math.min(range[0], t);
      range[1] = Math.max(range[1], t);
      return range;
    },
    [Infinity, -Infinity]
  );
}
function getTooltip(object, setDynRadius) {
  ///KARELIA mouse move
  findedradius = findradius(quadtree);
  setDynRadius(findedradius);
  //coordinate
  return;
  /*return (
    object &&
    `\
    ${object.name}
    Net gain: ${object.net}`
  );*/
}

/* eslint-disable react/no-deprecated */
export function Mapa({
  data,
  enableBrushing = true,
  brushRadius=1000000,
  strokeWidth = 2,
  opacity = 0.7,
  mapStyle = MAP_STYLE
}) {
  const dispatch = useDispatch();
  const { data2 } = useSwr("covid", async () => {
    const response = await fetch(
      "https://gist.githubusercontent.com/leighhalliday/a994915d8050e90d413515e97babd3b3/raw/a3eaaadcc784168e3845a98931780bd60afb362f/covid19.json"
    );
    const data2 = await response.json();
    return data2;
  });

  React.useEffect(() => {
    if (data2) {
      dispatch(
        addDataToMap({
          datasets: {
            info: {
              label: "COVID-19",
              id: "covid19"
            },
            data2
          },
          option: {
            centerMap: true,
            readOnly: false
          },
          config: {}
        })
      );
    }
  }, [dispatch, data2]);

  return (
    <KeplerGl
      id="covid"
      mapboxApiAccessToken={'pk.eyJ1Ijoia2FyZWxpYSIsImEiOiJjbGdrd3VwYTMwNGRwM2VxaWlvcW1nZTZhIn0.B4XP49caw1VVRVpjSh-nTQ'}
      width={window.innerWidth}
      height={window.innerHeight}
    />
  );
  // const {arcs, targets, sources} = useMemo(() => getLayerData(data), [data]);
  // const [dynRadius, setDynRadius] = useState(0);

  // const [filter, setFilter] = useState(null);
  // const timeRange = useMemo(() => getTimeRange(data), [data]);
  // const filterValue = filter || timeRange;

  // const tabPaneRef = useRef(null);

  // useEffect(() => {
  //   if (tabPaneRef.current) {
  //     const elements = tabPaneRef.current.querySelectorAll('.carousel-inner, .carousel-control, .close, .carousel-indicators-cell');
  //     for (let i = 0; i < elements.length; i++) {
  //       elements[i].style.display = '';
  //     }
  //   }
  // }, []);

  // const layers = arcs &&
  //   targets && [
  //     new ScatterplotLayer({
  //       id: 'sources',
  //       data: sources,
  //       brushingRadius: dynRadius,
  //       brushingEnabled: enableBrushing,
  //       // only show source points when brushing
  //       radiusScale: enableBrushing ? 3000 : 0,
  //       getFillColor: SOURCE_COLOR,
  //       getRadius: 0.003,
  //       getFilterValue: d => d.timestamp,
  //       filterRange: [filterValue[0], filterValue[1]],
  //       filterSoftRange: [
  //         filterValue[0] * 0.9 + filterValue[1] * 0.1,
  //         filterValue[0] * 0.1 + filterValue[1] * 0.9
  //       ],
  //       extensions: [brushingExtension]
  //     }),
  //     new ScatterplotLayer({
  //       id: 'targets',
  //       data: targets,
  //       brushingRadius: dynRadius,
  //       brushingEnabled: enableBrushing,
  //       pickable: true,
  //       radiusScale: 3000,
  //       getFillColor: TARGET_COLOR,
  //       getRadius: 0.003,
  //       getFilterValue: d => d.timestamp,
  //       filterRange: [filterValue[0], filterValue[1]],
  //       extensions: [brushingExtension],
  //     }),
     
  //     new ArcLayer({
  //       id: 'arc',
  //       data: arcs,
  //       getWidth: strokeWidth,
  //       opacity:0.05,
  //       brushingRadius: dynRadius,
  //       brushingEnabled: enableBrushing,
  //       getSourcePosition: d => d.source,
  //       getTargetPosition: d => d.target,
  //       getSourceColor: outFlowColors[0],
  //       getTargetColor: inFlowColors[0],
  //       getFilterValue: d => d.timestamp,
  //       filterRange: [filterValue[0], filterValue[1]],
  //       extensions: [brushingExtension],
  //     })

  //   ];

  // return (
  //   <>
  //   <DeckGL
  //     layers={layers}
  //     initialViewState={INITIAL_VIEW_STATE}
  //     controller={true}
  //     getTooltip={(e) => getTooltip(e, (newRadius) => setDynRadius(newRadius))}
  //     onHover={(e) => {
  //       if(typeof e.coordinate != 'undefined')
  //       {
  //         mouse_lat = e.coordinate[1];
  //         mouse_lng = e.coordinate[0];
  //       }
  //     }
  //     }
  //   >
    

  //   <div className="tab-pane active" ref={tabPaneRef}>
  //     {/* Rest of your component */}
  //     <div>
  //     <label>Opacity</label>
  //     <input id="radius" type="range" min="1000" max="20000" step="1000" value="1000"></input>
  //     <span id="opacity-value"></span>
  //   </div>
  //    <div>
  //     <label>Radius (# of trips)</label>
  //     <input id="radius" type="range" min="100" max="20000" step="100" value="1000"></input>
  //     <span id="radius-value"></span>
  //   </div>
  //   </div>

  //     {/* <Map reuseMaps mapLib={maplibregl} mapStyle={mapStyle} preventStyleDiffing={true} 
  //      onMouseMove={ e => console.log(e.point) }      
  //      /> */}
  //   </DeckGL>

  //   </>
  // );
}


export default function App() {
  return (
    <Provider store={store}>
      <Mapa />
    </Provider>
  );
}

export function renderToDOM(container) {
  const root = createRoot(container);
  root.render(
  <Provider store={store}>
    <Mapa />
  </Provider>);
  /*fetch(DATA_URL)
    .then(response => response.json())
    //.then((json) => console.log(json))
    .then(({features}) => {
      root.render(<App data={features}/>);
    });
  */

}

