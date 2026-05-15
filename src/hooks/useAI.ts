import { useState, useCallback } from 'react';
import { callAI } from '../ai/adapter';
import { resolveAiSettingsForTask } from '../lib/aiTaskSettings';
import {
  SIMPLIFY_SYSTEM,
  EXPLAIN_SYSTEM,
  EXTRACT_FORMULAS_SYSTEM,
  EXTRACT_DEFINITIONS_SYSTEM,
  COMPARISONS_SYSTEM,
  SUMMARY_SYSTEM,
} from '../ai/prompts';
import type { UserSettings } from '../types';

interface UseAIReturn {
  isLoading: boolean;
  error: string | null;
  simplify: (text: string, settings: UserSettings) => Promise<string>;
  explain: (text: string, settings: UserSettings) => Promise<string>;
  extractFormulas: (content: string, existingFormulas: string, settings: UserSettings) => Promise<string>;
  extractDefinitions: (content: string, settings: UserSettings) => Promise<string>;
  extractComparisons: (content: string, settings: UserSettings) => Promise<string>;
  summarize: (content: string, settings: UserSettings) => Promise<string>;
}

export function useAI(): UseAIReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simplify = useCallback(async (text: string, settings: UserSettings) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await callAI(
        `Rewrite this: "${text}"`,
        SIMPLIFY_SYSTEM,
        resolveAiSettingsForTask(settings, 'chat'),
      );
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Simplify failed';
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const explain = useCallback(async (text: string, settings: UserSettings) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await callAI(
        `Explain this: "${text}"`,
        EXPLAIN_SYSTEM,
        resolveAiSettingsForTask(settings, 'chat'),
      );
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Explain failed';
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const extractFormulas = useCallback(
    async (content: string, existingFormulas: string, settings: UserSettings) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await callAI(
          `Extract all formulas from: "${content}"`,
          EXTRACT_FORMULAS_SYSTEM(existingFormulas),
          resolveAiSettingsForTask(settings, 'chat'),
        );
        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Formula extraction failed';
        setError(message);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const extractDefinitions = useCallback(async (content: string, settings: UserSettings) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await callAI(
        `Extract all definitions from: "${content}"`,
        EXTRACT_DEFINITIONS_SYSTEM,
        resolveAiSettingsForTask(settings, 'chat'),
      );
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Definition extraction failed';
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const extractComparisons = useCallback(async (content: string, settings: UserSettings) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await callAI(
        `Find and compare easily confused concepts in: "${content}"`,
        COMPARISONS_SYSTEM,
        resolveAiSettingsForTask(settings, 'chat'),
      );
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Comparison extraction failed';
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const summarize = useCallback(async (content: string, settings: UserSettings) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await callAI(
        `Summarize: "${content}"`,
        SUMMARY_SYSTEM,
        resolveAiSettingsForTask(settings, 'chat'),
      );
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Summary failed';
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, simplify, explain, extractFormulas, extractDefinitions, extractComparisons, summarize };
}
