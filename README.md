# Redux-toolkit-saga
[![Build Status](https://travis-ci.com/anymore1405/redux-toolkit-saga.svg?branch=master)](https://travis-ci.com/anymore1405/redux-toolkit-saga) [![npm version](https://img.shields.io/npm/v/redux-toolkit-saga.svg?style=flat-square)](https://www.npmjs.com/package/redux-toolkit-saga) [![npm downloads](https://img.shields.io/npm/dt/redux-toolkit-saga.svg?style=flat-square)](https://www.npmjs.com/package/redux-toolkit-saga)

## Installation 
```sh
yarn add redux-toolkit-saga
# or
npm install redux-toolkit-saga --save
```

## createSliceSaga

| name           | required |                           description                                                                 |
| -------------- | --------  | --------------------------------------------------------------------------- |
| name       | YES       | A string name for this slice of state. Generated action type constants will use this as a prefix                                           |
| caseSagas | YES         | An object containing "case sagas" functions (functions intended to handle a specific action type|
| sagaType           | YES      | `SagaType.Normal`, `SagaType.Watch`, `SagaType.TakeLatest`|

## Example
```ts
import { createSliceSaga, SagaType } from "redux-toolkit-saga";
import { PayloadAction } from "@reduxjs/toolkit";

const slice = createSliceSaga({
  name: "testSlice",
  caseSagas: {
    action1: function* (action: PayloadAction<string>) {
      yield console.log("ok1", action.payload);
    },
    action2: function* (action: PayloadAction<number>) {
      yield console.log("ok2", action.payload);
    },
  },
  sagaType: SagaType.Watch,
});

const composeSaga = slice.saga; // call composeSaga in root saga

const { action1, action2 } = slice.actions; // action with caseSagas

```