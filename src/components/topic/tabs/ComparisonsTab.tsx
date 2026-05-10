import { ExtractionWorkbench, extractionHelpers } from '../shared/ExtractionWorkbench';
import type { ExtractionItem } from '../../../types';

interface ComparisonsTabProps {
  topicId: string;
}

function noExisting(_items: ExtractionItem[]) {
  return '';
}

export function ComparisonsTab({ topicId }: ComparisonsTabProps) {
  return (
    <ExtractionWorkbench
      topicId={topicId}
      extractionType="comparison"
      heading="Similarity comparisons"
      buildExistingPrompt={noExisting}
      mapResponseToItems={extractionHelpers.mapComparisonBlocks}
    />
  );
}
