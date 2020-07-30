/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Action, AnyAction } from 'redux';
import {
  PayloadAction,
  PayloadActionCreator,
  ActionCreatorWithoutPayload,
  PrepareAction,
  createAction,
  ActionCreatorWithPreparedPayload,
} from '@reduxjs/toolkit';
import { _ActionCreatorWithPreparedPayload } from '@reduxjs/toolkit/dist/index';
import {
  call,
  takeLatest,
  all,
  CallEffect,
  take,
  fork,
  AllEffect,
} from 'redux-saga/effects';

export enum SagaType {
  Watch,
  Normal,
  TakeLatest,
}

export type CaseSagas<A extends Action = AnyAction> = (action: A) => void;

export type SliceCaseSagas = {
  [K: string]: CaseSagas<PayloadAction<any>>;
};

type ActionCreatorForCaseSagaWithPrepare<
  CR extends { prepare: any }
> = _ActionCreatorWithPreparedPayload<CR['prepare'], string>;

type ActionCreatorForCaseSagas<CR> = CR extends (action: infer Action) => any
  ? Action extends { payload: infer P }
    ? PayloadActionCreator<P>
    : ActionCreatorWithoutPayload
  : ActionCreatorWithoutPayload;

export type CaseSagaActions<CaseSagas extends SliceCaseSagas> = {
  [Type in keyof CaseSagas]: CaseSagas[Type] extends { prepare: any }
    ? ActionCreatorForCaseSagaWithPrepare<CaseSagas[Type]>
    : ActionCreatorForCaseSagas<CaseSagas[Type]>;
};

export type ValidateSliceCaseSagas<ACR extends SliceCaseSagas> = ACR &
  {
    [T in keyof ACR]: ACR[T] extends {
      saga(action?: infer A): any;
    }
      ? {
          prepare(...a: never[]): Omit<A, 'type'>;
        }
      : {};
  };

export interface CreateOptionsSliceSaga<
  CR extends SliceCaseSagas = SliceCaseSagas,
  Name extends string = string
> {
  name: Name;
  caseSagas: ValidateSliceCaseSagas<CR>;
  sagaType: SagaType;
}

export interface Slice<
  CaseSagas extends SliceCaseSagas = SliceCaseSagas,
  Name extends string = string
> {
  name: Name;
  saga: any;
  actions: CaseSagaActions<CaseSagas>;
  sagaType: SagaType;
}

export function createTakeLatestSaga(
  type: string,
  sagaFunction: CaseSagas<PayloadAction<any>>,
): any {
  return function* () {
    yield takeLatest(type, sagaFunction);
  };
}

export function createWatchSaga(
  type: string,
  sagaFunction: CaseSagas<PayloadAction<any>>,
): any {
  return function* () {
    while (true) {
      const action = yield take(type);
      yield fork(sagaFunction, action);
    }
  };
}

export function createSagas(sagas: any[]): any {
  const sagaTemp = [];
  sagas.forEach((saga: any) => {
    sagaTemp.push(call(saga));
  });
  return function* () {
    yield all(sagaTemp);
  };
}

export function getType(slice: string, actionKey: string): string {
  return `${slice}/${actionKey}`;
}

export function createSliceSaga<
  CaseSagas extends SliceCaseSagas,
  Name extends string = string
>(options: CreateOptionsSliceSaga<CaseSagas, Name>): Slice<CaseSagas, Name> {
  const { caseSagas, name, sagaType } = options;
  const caseSagasNames = Object.keys(caseSagas);
  const actionCreators: Record<
    string,
    ActionCreatorWithPreparedPayload<any[], any, string, never, never>
  > = {};
  const sagas: CallEffect[] = [];

  caseSagasNames.forEach((sagaName) => {
    const type = getType(name, sagaName);
    let prepareCallback: PrepareAction<any> | undefined;
    actionCreators[sagaName] = prepareCallback
      ? createAction(type, prepareCallback)
      : createAction(type);

    sagas.push(
      call(
        sagaType == SagaType.Normal
          ? caseSagas[sagaName]
          : sagaType == SagaType.Watch
          ? createWatchSaga(type, caseSagas[sagaName])
          : createTakeLatestSaga(type, caseSagas[sagaName]),
      ),
    );
  });
  const saga: () => Generator<
    AllEffect<CallEffect<any>>,
    void,
    unknown
  > = function* () {
    yield all(sagas);
  };

  return { saga, name, actions: actionCreators as any, sagaType };
}
