import * as types from '../constants/actionTypes';
import { push } from 'react-router-redux';
import {
  readLinks,
  fileWithName,
  analyze
} from '../utils/ipfs';
import { arrayPathToString, pathToArrayOfObjects } from '../utils/path';

export function setPath(path) {
  return function(dispatch) {
    if (path.length > 0) saveRootHash(path[0].hash);
    dispatch({type: types.SET_PATH, path });
    dispatch(push(arrayPathToString(path)));
  };
}

export function goTo(path) {
  return async function(dispatch) {
    path = pathToArrayOfObjects(path);
    dispatch(setPath(path));
    const hash = path[0].hash;
    const analysis = await analyze({ hash });
    const newPath = [Object.assign({}, path[0], analysis)];
    let files = await readLinks(newPath[0].hash);
    const subpaths = path.slice(1);
    for (const subpath of subpaths) {
      if (subpath.hash) {
        newPath.push(Object.assign({}, subpath));
      } else {
        const matches = files.filter(f => f.name === subpath.name);
        if(matches.length > 0) {
          newPath[newPath.length-1].folder = true;
          const hash = matches[0].hash;
          const analysis = await analyze({ hash });
          newPath.push(Object.assign({}, subpath, { hash }, analysis));
          files = await readLinks(hash);
        } else {
          // TODO errors
          return dispatch({type: 'ERROR'});
        }
      }
    }
    const finalHash = newPath[newPath.length-1].hash;
    dispatch(setPath(newPath));
    files = await dispatch(readDir(finalHash));
    dispatch({type: types.CHANGE_FILES, files});
  };
}

export function goToRelative(path) {
  return async function(dispatch, getState) {
    let newPath = [ ...getState().ipfs.path ];
    const files = getState().ipfs.files;
    if (path === '..') {
      newPath = newPath.slice(0, newPath.length-1);
    } else {
      const child = fileWithName(files, path);
      if (child) {
        newPath.push(child);
      } else {
        // TODO errors
        dispatch({type:'ERROR'});
      }
    }
    if (newPath[newPath.length-1].folder) {
      dispatch(goTo(newPath));
    } else {
      // TODO errors
      dispatch({type:'ERROR'});
    }
  };
}

export function goToHashInPath(hash) {
  return function (dispatch, getState) {
    const path = getState().ipfs.path;
    const newPath = [];
    for (const item of path) {
      newPath.push(item);
      if (item.hash === hash) {
        return dispatch(goTo(newPath));
      }
    }
    // TODO not found?
  };
}

function saveRootHash(hash) {
  window.localStorage.setItem('ipfsDriveRootHash', hash);
}

export const emptyHash = 'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn';

export function loadRootHash() {
  return window.localStorage.getItem('ipfsDriveRootHash') || emptyHash;
}

export function readDir (hash) {
  return async function (dispatch) {
    let links = await readLinks(hash);
    links.map(async link => {
      const analysis = await analyze(link);
      dispatch({
        type: types.LINK_ANALYSIS,
        item: analysis
      });
    });
    return links;
  };
}
