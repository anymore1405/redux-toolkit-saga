/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Action, AnyAction } from 'redux';
import {
  PayloadAction,
  PayloadActionCreator,
  ActionCreatorWithoutPayload,
  PrepareAction,
  createAction,
} from '@reduxjs/toolkit';
import { _ActionCreatorWithPreparedPayload } from '@reduxjs/toolkit/dist/index';
import { call, takeLatest, all } from 'redux-saga/effects';

export type CaseSagas<A extends Action = AnyAction> = (action: A) => void;

export type SliceCaseSagas = {
  [K: string]: CaseSagas<PayloadAction<any>>;
};

type ActionCreatorForCaseSagaWithPrepare<
  CR extends { prepare: any }
> = _ActionCreatorWithPreparedPayload<CR['prepare'], string>;

/**
 * Get a `PayloadActionCreator` type for a passed `CaseReducer`
 *
 * @internal
 */
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
  isWatchSaga: boolean;
}

export interface Slice<
  CaseSagas extends SliceCaseSagas = SliceCaseSagas,
  Name extends string = string
> {
  name: Name;
  saga: any;
  actions: CaseSagaActions<CaseSagas>;
  isWatchSaga: boolean;
}

export function createWatchSaga(
  type: string,
  sagaFunction: CaseSagas<PayloadAction<any>>,
): any {
  return function* () {
    yield takeLatest(type, sagaFunction);
  };
}

export function getType(slice: string, actionKey: string): string {
  return `${slice}/${actionKey}`;
}

export function createSliceSaga<
  CaseSagas extends SliceCaseSagas,
  Name extends string = string
>(options: CreateOptionsSliceSaga<CaseSagas, Name>): Slice<CaseSagas, Name> {
  const { caseSagas, name, isWatchSaga } = options;
  const caseSagasNames = Object.keys(caseSagas);
  const actionCreators: Record<string, Function> = {};
  const sagas: any[] = [];

  caseSagasNames.forEach((sagaName) => {
    const type = getType(name, sagaName);
    let prepareCallback: PrepareAction<any> | undefined;
    actionCreators[sagaName] = prepareCallback
      ? createAction(type, prepareCallback)
      : createAction(type);

    sagas.push(function* () {
      yield call(
        isWatchSaga
          ? createWatchSaga(sagaName, caseSagas[sagaName])
          : caseSagas[sagaName],
      );
    });
  });
  const saga: any = function* () {
    yield all([...sagas]);
  };

  return { saga, name, actions: actionCreators as any, isWatchSaga };
}
