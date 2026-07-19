public with sharing class ClaimDocumentOrganizerController {
    private static final String PROMPT_TEMPLATE = 'insuranceClaimDocumentClassifier';

    /** Category contract shared with the LWC and serialized for the prompt template. */
    public class DocumentCategory {
        @AuraEnabled
        public String key { get; set; }

        @AuraEnabled
        public String label { get; set; }

        @AuraEnabled
        public String description { get; set; }
    }

    @AuraEnabled
    public static LightningTypes.insuranceClaimDocumentClassificationOutput classifyDocument(
        Id contentDocumentId,
        List<DocumentCategory> expectedCategories
    ) {
        if (contentDocumentId == null || expectedCategories == null || expectedCategories.isEmpty()) {
            throw new AuraHandledException('A document and expected categories are required.');
        }

        ConnectApi.EinsteinPromptTemplateGenerationsInput input =
            new ConnectApi.EinsteinPromptTemplateGenerationsInput();
        input.isPreview = false;
        input.additionalConfig = new ConnectApi.EinsteinLlmAdditionalConfigInput();
        input.additionalConfig.applicationName = 'PromptTemplateGenerationsInvocable';
        input.inputParams = new Map<String, ConnectApi.WrappedValue>{
            'Input:claimDocument' => wrap(
                new Map<String, String>{
                    'id' => String.valueOf(contentDocumentId),
                    'type' => 'ContentDocument'
                }
            ),
            'Input:expectedCategories' => wrap(JSON.serialize(expectedCategories))
        };

        ConnectApi.EinsteinPromptTemplateGenerationsRepresentation result =
            ConnectApi.EinsteinLLM.generateMessagesForPromptTemplate(PROMPT_TEMPLATE, input);

        if (result.generations == null || result.generations.isEmpty()) {
            throw new AuraHandledException('The document classifier returned no result.');
        }

        return (LightningTypes.insuranceClaimDocumentClassificationOutput)
            result.generations[0].structuredResponse;
    }

    private static ConnectApi.WrappedValue wrap(Object value) {
        ConnectApi.WrappedValue wrappedValue = new ConnectApi.WrappedValue();
        wrappedValue.value = value;
        return wrappedValue;
    }
}
