import { ExtractionWorkbench, extractionHelpers } from '../shared/ExtractionWorkbench';

interface FormulasTabProps {
  topicId: string;
}

export function FormulasTab({ topicId }: FormulasTabProps) {
  return (
    <ExtractionWorkbench
      topicId={topicId}
      extractionType="formula"
      heading="Formulas"
      buildExistingPrompt={extractionHelpers.formulasExistingList}
      mapResponseToItems={extractionHelpers.mapFormulaLines}
    />
  );
}
