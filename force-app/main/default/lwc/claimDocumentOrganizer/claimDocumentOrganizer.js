import {LightningElement} from 'lwc';
import claimIllustration from '@salesforce/resourceUrl/illustrationInsuranceClaim';

const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png,.heic';
const REQUIRED_DOCUMENTS = [
    {
        id: 'accident-statement',
        iconName: 'utility:contract_doc',
        label: 'Accident statement',
        titleForCustomer: 'Your accident statement, signed by you and the other driver',
        description: 'A jointly completed road accident statement (e.g. the standardized European Accident Statement form): two-column layout for vehicle A and vehicle B, driver and insurer details, tick-box accident circumstances, a sketch of the collision, and signatures of both drivers. Distinguish from a police report, which is issued by police and bears a case number and official stamps rather than two drivers\' signatures.'
    },
    {
        id: 'vehicle-registration-certificate',
        iconName: 'utility:identity',
        label: 'Vehicle registration certificate',
        titleForCustomer: 'Your vehicle’s registration certificate',
        description: 'An official government-issued vehicle registration document: registration (plate) number, VIN, owner or holder details, vehicle make and technical data, issuing authority, official seals or security features. Typically a small card or standardized form, not a letter, invoice, or insurance policy.'
    },
    {
        id: 'damage-photos',
        iconName: 'utility:image',
        label: 'Damage photos',
        titleForCustomer: 'Photos of your vehicle showing the damaged areas',
        description: 'A photograph of a vehicle showing visible damage such as dents, scratches, broken lights, or deformed body panels. Contains little or no text. A photograph or scan of a paper document is NOT this category, even if the photo quality is poor — classify it by the document it depicts.'
    }
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PROCESSING_DELAY = 1200;

export default class ClaimDocumentOrganizer extends LightningElement {
    claimIllustrationUrl = claimIllustration;
    acceptedFileTypes = ACCEPTED_FILE_TYPES;
    requiredDocuments = REQUIRED_DOCUMENTS;
    files = [];
    isProcessing = false;
    showSubmissionConfirmation = false;
    nextFileId = 1;
    processingTimer;

    get isEmptyState() {
        return !this.isProcessing && this.files.length === 0;
    }

    get categoryOptions() {
        return REQUIRED_DOCUMENTS.map(({label}) => ({label, value: label}));
    }

    get displayFiles() {
        return this.files.map((file) => ({
            ...file,
            categoryLabel: file.customerChanged ? 'Selected category' : 'Suggested category',
            fileDetailLabel: `${file.extension} · ${file.sizeLabel}`
        }));
    }

    get fileCountLabel() {
        const count = this.files.length;
        return `${count} ${count === 1 ? 'item' : 'items'} added`;
    }

    disconnectedCallback() {
        window.clearTimeout(this.processingTimer);
    }

    handleFilesSelected(event) {
        const selectedFiles = Array.from(event.target.files || []);
        event.target.value = '';

        if (!selectedFiles.length) {
            return;
        }

        this.showSubmissionConfirmation = false;
        this.isProcessing = true;

        const preparedFiles = selectedFiles
            .filter((file) => file.size <= MAX_FILE_SIZE)
            .map((file) => this.prepareFile(file));

        window.clearTimeout(this.processingTimer);
        this.processingTimer = window.setTimeout(() => {
            this.files = [...this.files, ...preparedFiles];
            this.isProcessing = false;
            this.processingTimer = undefined;
        }, PROCESSING_DELAY);
    }

    prepareFile(file) {
        const classification = this.classifyFile(file);
        const extension = this.getExtension(file.name);

        return {
            id: String(this.nextFileId++),
            name: file.name,
            sizeLabel: this.formatFileSize(file.size),
            extension,
            iconName: classification.iconName,
            category: classification.category,
            needsReview: !classification.isConfident,
            customerChanged: false,
            isEditing: false
        };
    }

    classifyFile(file) {
        const searchableName = file.name.toLowerCase();
        const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|heic)$/i.test(file.name);

        if (/registration|vehicle|dow[oó]d|rejestr/.test(searchableName)) {
            return {
                category: 'Vehicle registration certificate',
                isConfident: true,
                iconName: 'doctype:pdf'
            };
        }

        if (/statement|collision|accident|o[sś]wiadczenie/.test(searchableName)) {
            return {
                category: 'Accident statement',
                isConfident: true,
                iconName: isImage ? 'doctype:image' : 'doctype:pdf'
            };
        }

        if (isImage) {
            return {
                category: 'Damage photos',
                isConfident: true,
                iconName: 'doctype:image'
            };
        }

        return {
            category: 'Accident statement',
            isConfident: false,
            iconName: 'doctype:pdf'
        };
    }

    handleEditCategory(event) {
        const fileId = event.currentTarget.dataset.id;
        this.files = this.files.map((file) =>
            file.id === fileId ? {...file, isEditing: true} : file
        );
    }

    handleCategoryChange(event) {
        const fileId = event.currentTarget.dataset.id;
        const category = event.detail.value;

        this.files = this.files.map((file) => {
            if (file.id !== fileId) {
                return file;
            }

            return {
                ...file,
                category,
                customerChanged: true,
                needsReview: false,
                isEditing: false
            };
        });
    }

    handleRemove(event) {
        const fileId = event.currentTarget.dataset.id;
        this.files = this.files.filter((file) => file.id !== fileId);
        this.showSubmissionConfirmation = false;
    }

    handleSubmit() {
        this.showSubmissionConfirmation = true;
    }

    dismissConfirmation() {
        this.showSubmissionConfirmation = false;
    }

    getExtension(fileName) {
        const extension = fileName.includes('.') ? fileName.split('.').pop() : 'FILE';
        return extension.toUpperCase();
    }

    formatFileSize(bytes) {
        if (bytes < 1024 * 1024) {
            return `${Math.max(1, Math.round(bytes / 1024))} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}
