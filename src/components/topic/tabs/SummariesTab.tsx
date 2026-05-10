import { ExtractionWorkbench, extractionHelpers } from '../shared/ExtractionWorkbench';
import type { ExtractionItem } from '../../../types';

interface SummariesTabProps {
  topicId: string;
}

function noExisting(_items: ExtractionItem[]) {
  return '';
}

export function SummariesTab({ topicId }: SummariesTabProps) {
  return (
    <ExtractionWorkbench
      topicId={topicId}
      extractionType="summary"
      heading="Summaries"
      buildExistingPrompt={noExisting}
      mapResponseToItems={extractionHelpers.mapSummaryLines}
    />
  );
}
