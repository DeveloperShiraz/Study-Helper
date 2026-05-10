import { ExtractionWorkbench, extractionHelpers } from '../shared/ExtractionWorkbench';
import type { ExtractionItem } from '../../../types';

interface DefinitionsTabProps {
  topicId: string;
}

function noExisting(_items: ExtractionItem[]) {
  return '';
}

export function DefinitionsTab({ topicId }: DefinitionsTabProps) {
  return (
    <ExtractionWorkbench
      topicId={topicId}
      extractionType="definition"
      heading="Definitions"
      buildExistingPrompt={noExisting}
      mapResponseToItems={extractionHelpers.mapDefinitionBlocks}
    />
  );
}
