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

export type SliceCaseSagas = {
  [K: string]: CaseSagas<PayloadAction<any>>;
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

export interface Slice<
  CaseSagas extends SliceCaseSagas = SliceCaseSagas,
  Name extends string = string
> {
  name: Name;
  saga: () => Generator<AllEffect<CallEffect<any>>, void, unknown>;
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
  const { caseSagas, name, sagaType = SagaType.TakeEvery } = options;
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
        sagaType === SagaType.Normal
          ? caseSagas[sagaName]
          : createSaga(sagaType, type, caseSagas[sagaName]),
      ),
    );
  });
  function* saga(): Generator<AllEffect<CallEffect<any>>, void, unknown> {
    yield all(sagas);
  }

  return { saga, name, actions: actionCreators as any, sagaType };
}
