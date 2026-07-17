import { LightningElement } from 'lwc';

const CATEGORY_OPTIONS = [
    'Accident statement',
    'Vehicle registration certificate',
    'Damage photo',
    'Other'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default class ClaimDocumentOrganizer extends LightningElement {
    files = [];
    isProcessing = false;
    showSubmissionConfirmation = false;
    nextFileId = 1;
    processingTimer;

    get isEmptyState() {
        return !this.isProcessing && this.files.length === 0;
    }

    get displayFiles() {
        return this.files.map((file) => ({
            ...file,
            categoryLabel: file.customerChanged ? 'Selected category' : 'Suggested category',
            fileDetailLabel: `${file.extension} · ${file.sizeLabel}`,
            categoryOptions: CATEGORY_OPTIONS.map((category) => ({
                label: category,
                value: category
            }))
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
        }, 1200);
    }

    prepareFile(file) {
        const classification = this.classifyFile(file);
        const extension = this.getExtension(file.name);

        return {
            id: String(this.nextFileId++),
            name: file.name,
            sizeLabel: this.formatFileSize(file.size),
            extension,
            typeLabel: file.type || `${extension} file`,
            kind: classification.kind,
            iconName: classification.iconName,
            category: classification.category,
            isConfident: classification.isConfident,
            needsReview: !classification.isConfident,
            customerChanged: false,
            isEditing: false,
            originalFile: file
        };
    }

    classifyFile(file) {
        const searchableName = file.name.toLowerCase();
        const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|heic)$/i.test(file.name);

        if (/registration|vehicle|dow[oó]d|rejestr/.test(searchableName)) {
            return {
                category: 'Vehicle registration certificate',
                isConfident: true,
                kind: 'registration',
                iconName: 'doctype:pdf'
            };
        }

        if (/statement|collision|accident|o[sś]wiadczenie/.test(searchableName)) {
            return {
                category: 'Accident statement',
                isConfident: true,
                kind: 'statement',
                iconName: isImage ? 'doctype:image' : 'doctype:pdf'
            };
        }

        if (isImage) {
            return {
                category: 'Damage photo',
                isConfident: true,
                kind: 'photo',
                iconName: 'doctype:image'
            };
        }

        return {
            category: 'Accident statement',
            isConfident: false,
            kind: 'unknown',
            iconName: 'doctype:pdf'
        };
    }

    handleEditCategory(event) {
        const fileId = event.currentTarget.dataset.id;
        this.files = this.files.map((file) => ({
            ...file,
            isEditing: file.id === fileId ? true : file.isEditing
        }));
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
                isConfident: true,
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
