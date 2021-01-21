/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Action, AnyAction } from 'redux';
import {
  PayloadAction,
  PayloadActionCreator,
  ActionCreatorWithoutPayload,
  createAction,
  ActionCreatorWithPreparedPayload,
} from '@reduxjs/toolkit';
import {
  call,
  takeLatest,
  takeEvery,
  all,
  CallEffect,
  take,
  fork,
  AllEffect,
} from 'redux-saga/effects';
import { SagaIterator } from 'redux-saga';
export enum SagaType {
  Watch,
  Normal,
  TakeLatest,
  TakeEvery,
}

export type CaseSagas<A extends Action = AnyAction> = (
  action: A,
) => Generator<unknown, unknown, SagaIterator>;

type CustomCaseSaga = {
  fn: CaseSagas<PayloadAction<any>>;
  sagaType?: SagaType;
};

export type SliceCaseSagas = {
  [K: string]: CaseSagas<PayloadAction<any>> | CustomCaseSaga;
};

type ActionCreatorForCaseSagaWithPrepare<
  CR extends { prepare: any }
> = ActionCreatorWithPreparedPayload<CR['prepare'], string>;

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
  sagaType?: SagaType;
}

type SagaFunReturnType = Generator<AllEffect<CallEffect<any>>, void, unknown>;

export interface Slice<
  CaseSagas extends SliceCaseSagas = SliceCaseSagas,
  Name extends string = string
> {
  name: Name;
  saga: () => SagaFunReturnType;
  actions: CaseSagaActions<CaseSagas>;
  sagaType: SagaType;
}

export function createSaga(
  sagaType: string | number,
  type: string,
  sagaFunction: CaseSagas<PayloadAction<any>>,
): any {
  switch (sagaType) {
    case SagaType.TakeLatest:
      return function* () {
        yield takeLatest(type, sagaFunction);
      };
    case SagaType.Watch:
      return function* () {
        while (true) {
          const action = yield take(type);
          yield fork(sagaFunction, action);
        }
      };
    default:
      return function* () {
        yield takeEvery(type, sagaFunction);
      };
  }
}

export function createSagas(
  sagas: (() => Generator<unknown, void, SagaIterator>)[],
): any {
  const sagaTemp = sagas.map((saga: any) => {
    return call(saga);
  });
  return function* () {
    yield all(sagaTemp);
  };
}

export function getType(slice: string, actionKey: string): string {
  return `${slice}/${actionKey}`;
}

function isCustomCaseSaga(value: unknown): value is CustomCaseSaga {
  return (
    typeof value === 'object' &&
    typeof (value as CustomCaseSaga).fn === 'function'
  );
}

export function createSliceSaga<
  CaseSagas extends SliceCaseSagas,
  Name extends string = string
>(options: CreateOptionsSliceSaga<CaseSagas, Name>): Slice<CaseSagas, Name> {
  const { caseSagas, name, sagaType: globalSagaType } = options;
  const caseSagasNames = Object.keys(caseSagas);
  const actionCreators: Record<
    string,
    ActionCreatorWithPreparedPayload<any[], any, string, never, never>
  > = {};
  const sagas: CallEffect[] = [];

  caseSagasNames.forEach((sagaName) => {
    const type = getType(name, sagaName);

    actionCreators[sagaName] = createAction(type);

    const currentCaseSaga = caseSagas[sagaName];

    let toBeCalled;

    if (isCustomCaseSaga(currentCaseSaga)) {
      toBeCalled =
        currentCaseSaga.sagaType === SagaType.Normal
          ? currentCaseSaga.fn
          : createSaga(currentCaseSaga.sagaType, type, currentCaseSaga.fn);
    } else {
      toBeCalled =
        globalSagaType === SagaType.Normal
          ? currentCaseSaga
          : createSaga(globalSagaType, type, currentCaseSaga);
    }

    sagas.push(call(toBeCalled));
  });

  function* saga(): SagaFunReturnType {
    yield all(sagas);
  }

  return {
    saga,
    name,
    actions: actionCreators as any,
    sagaType: globalSagaType,
  };
}
