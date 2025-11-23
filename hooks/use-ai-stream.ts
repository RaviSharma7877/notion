import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AiStreamEvent, AiStreamHandlers, AiStreamSubscription } from '@/lib/queries';

export type AiStreamStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';

interface UseAiStreamOptions {
  initialText?: string;
  transformChunk?: (chunk: string, event: AiStreamEvent) => string;
  onEvent?: (event: AiStreamEvent) => void;
}

interface UseAiStreamState {
  status: AiStreamStatus;
  text: string;
  isStreaming: boolean;
  error?: string;
  events: AiStreamEvent[];
}

interface UseAiStreamReturn<TInput> extends UseAiStreamState {
  start: (input: TInput) => void;
  cancel: () => void;
  reset: () => void;
}

export function useAiStream<TInput>(
  startFactory: (input: TInput, handlers: AiStreamHandlers) => AiStreamSubscription,
  options: UseAiStreamOptions = {}
): UseAiStreamReturn<TInput> {
  const { initialText = '', transformChunk = (chunk) => chunk, onEvent } = options;
  const subscriptionRef = useRef<AiStreamSubscription | null>(null);
  const [state, setState] = useState<UseAiStreamState>({
    status: 'idle',
    text: initialText,
    isStreaming: false,
    events: [],
  });

  const cancel = useCallback(() => {
    subscriptionRef.current?.cancel();
    subscriptionRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState({
      status: 'idle',
      text: initialText,
      isStreaming: false,
      events: [],
      error: undefined,
    });
  }, [cancel, initialText]);

  const start = useCallback(
    (input: TInput) => {
      cancel();
      setState({
        status: 'connecting',
        text: '',
        isStreaming: true,
        events: [],
        error: undefined,
      });

      const subscription = startFactory(input, {
        onEvent: (event) => {
          setState((prev) => ({
            ...prev,
            events: [...prev.events, event],
          }));
          onEvent?.(event);
        },
        onStart: () => {
          setState((prev) => ({
            ...prev,
            status: 'streaming',
            isStreaming: true,
          }));
        },
        onChunk: (chunk, event) => {
          const transformed = transformChunk(chunk, event);
          if (!transformed) return;
          setState((prev) => ({
            ...prev,
            text: prev.text + transformed,
          }));
        },
        onDone: () => {
          setState((prev) => ({
            ...prev,
            status: prev.status === 'error' ? prev.status : 'complete',
          }));
        },
        onError: (error) => {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: error.message,
          }));
        },
        onFinish: () => {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
          }));
        },
      });

      subscriptionRef.current = subscription;
    },
    [cancel, onEvent, startFactory, transformChunk]
  );

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return useMemo(
    () => ({
      ...state,
      start,
      cancel,
      reset,
    }),
    [cancel, reset, start, state]
  );
}

