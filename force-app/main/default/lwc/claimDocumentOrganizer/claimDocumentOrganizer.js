import {api, LightningElement} from 'lwc';
import Toast from 'lightning/toast';
import {deleteRecord} from 'lightning/uiRecordApi';
import classifyDocument from '@salesforce/apex/ClaimDocumentOrganizerController.classifyDocument';
import claimIllustration from '@salesforce/resourceUrl/illustrationInsuranceClaim';

const REQUIRED_DOCUMENTS = [
    {
        key: 'accident-statement',
        iconName: 'utility:contract_doc',
        label: 'Accident statement',
        titleForCustomer: 'Your accident statement, signed by you and the other driver',
        description: 'A jointly completed road accident statement (e.g. the standardized European Accident Statement form): two-column layout for vehicle A and vehicle B, driver and insurer details, tick-box accident circumstances, a sketch of the collision, and signatures of both drivers. Distinguish from a police report, which is issued by police and bears a case number and official stamps rather than two drivers\' signatures.'
    },
    {
        key: 'vehicle-registration-certificate',
        iconName: 'utility:identity',
        label: 'Vehicle registration certificate',
        titleForCustomer: 'Your vehicle’s registration certificate',
        description: 'An official government-issued vehicle registration document: registration (plate) number, VIN, owner or holder details, vehicle make and technical data, issuing authority, official seals or security features. Typically a small card or standardized form, not a letter, invoice, or insurance policy.'
    },
    {
        key: 'damage-photos',
        iconName: 'utility:image',
        label: 'Damage photos',
        titleForCustomer: 'Photos of your vehicle showing the damaged areas',
        description: 'A photograph of a vehicle showing visible damage such as dents, scratches, broken lights, or deformed body panels. Contains little or no text. A photograph or scan of a paper document is NOT this category, even if the photo quality is poor — classify it by the document it depicts.'
    }
];

const EXPECTED_CATEGORIES = REQUIRED_DOCUMENTS.map(({key, label, description}) => ({
    key,
    label,
    description
}));
const CONFIDENT_CLASSIFICATION_SCORE = 85;

export default class ClaimDocumentOrganizer extends LightningElement {
    @api recordId;

    claimIllustrationUrl = claimIllustration;
    files = [];
    isProcessing = false;
    showSubmissionConfirmation = false;

    get isEmptyState() {
        return !this.isProcessing && this.files.length === 0;
    }

    get acceptedFileTypes() {
        return ['.pdf', '.jpg', '.jpeg', '.png', '.heic'];
    }

    get categoryOptions() {
        return REQUIRED_DOCUMENTS.map(({label}) => ({label, value: label}));
    }

    get requiredDocuments() {
        const providedCategories = new Set(
            this.files.filter(({isDeleting}) => !isDeleting).map(({category}) => category)
        );

        return REQUIRED_DOCUMENTS.map((document) => {
            const isSatisfied = providedCategories.has(document.label);

            return {
                ...document,
                isSatisfied,
                iconVariant: isSatisfied ? 'success' : undefined
            };
        });
    }

    get isSubmissionDisabled() {
        return REQUIRED_DOCUMENTS.some(
            ({label}) =>
                !this.files.some(
                    ({category, isDeleting}) => category === label && !isDeleting
                )
        );
    }

    async handleUploadFinished(event) {
        const uploadedFiles = event.detail.files;

        if (!uploadedFiles.length) {
            return;
        }

        this.showSubmissionConfirmation = false;
        this.isProcessing = true;

        const classifiedFiles = await Promise.all(
            uploadedFiles.map(async (file) => {
                try {
                    return await this.classifyUploadedFile(file);
                } catch {
                    return this.createFile(file);
                }
            })
        );

        this.files = [...this.files, ...classifiedFiles];
        this.isProcessing = false;
    }

    async classifyUploadedFile(file) {
        const classification = await classifyDocument({
            contentDocumentId: file.documentId,
            expectedCategories: EXPECTED_CATEGORIES
        });
        const matchedCategory = REQUIRED_DOCUMENTS.find(({key}) =>
            classification.categoryFound && classification.categoryKey === key
        );

        const needsReview =
            !matchedCategory ||
            !classification.documentReadable ||
            classification.ambiguous ||
            classification.containsMultipleDocuments ||
            classification.confidenceScore < CONFIDENT_CLASSIFICATION_SCORE;

        return this.createFile(file, {category: matchedCategory?.label, needsReview});
    }

    createFile(file, classification = {}) {
        const category = classification.category || '';
        const needsReview = classification.needsReview ?? true;

        return {
            id: file.documentId,
            name: file.name,
            iconName: this.getFileIcon(file.name),
            category,
            needsReview,
            reviewMessage: needsReview
                ? category
                    ? 'We are not fully confident in this category. Please review and confirm it.'
                    : 'We could not automatically determine the category. Please select one.'
                : '',
            detectedAutomatically: Boolean(category),
            isDeleting: false
        };
    }

    handleCategoryChange(event) {
        const fileId = event.currentTarget.dataset.id;
        const category = event.detail.value;

        this.showSubmissionConfirmation = false;
        this.files = this.files.map((file) =>
            file.id === fileId
                ? {
                      ...file,
                      category,
                      needsReview: false,
                      detectedAutomatically: false
                  }
                : file
        );
    }

    async handleRemove(event) {
        const fileId = event.currentTarget.dataset.id;
        this.files = this.files.map((file) =>
            file.id === fileId ? {...file, isDeleting: true} : file
        );

        try {
            await deleteRecord(fileId);
            this.files = this.files.filter((file) => file.id !== fileId);
            this.showSubmissionConfirmation = false;
        } catch {
            this.files = this.files.map((file) =>
                file.id === fileId ? {...file, isDeleting: false} : file
            );
            Toast.show(
                {
                    label: 'Document could not be removed',
                    message: 'Try again or contact your administrator.',
                    variant: 'error'
                },
                this
            );
        }
    }

    handleSubmit() {
        if (this.isSubmissionDisabled) {
            return;
        }

        this.showSubmissionConfirmation = true;
    }

    dismissConfirmation() {
        this.showSubmissionConfirmation = false;
    }

    getFileIcon(fileName) {
        return /\.(jpe?g|png|heic)$/i.test(fileName) ? 'doctype:image' : 'doctype:pdf';
    }
}
