// Configuration
let config = {
    claudeApiKey: '',
    // Hardcoded Supabase credentials (shared database for all users)
    supabaseUrl: 'https://bjnjrgnvndpxbkkdyvyd.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqbmpyZ252bmRweGJra2R5dnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzEyMjUsImV4cCI6MjA4MjI0NzIyNX0.s5UzpAZXRVBIKh69O5EKk1-MYKPPCNnrAStsttlsb0w'
};

// State
let currentFile = null;
let currentImageData = null;
let currentTranscription = null;
let supabase = null;

// PDF-specific state
let currentPDFProcessor = null;
let currentPDFFile = null;
let processingType = null; // 'image' | 'pdf'

// Detect file type helper
function detectFileType(file) {
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('image/')) return 'image';
    return 'unknown';
}

// DOM Elements
const fileInput = document.getElementById('file-input');
const uploadArea = document.getElementById('upload-area');
const transcribeBtn = document.getElementById('transcribe-btn');
const previewSection = document.getElementById('preview-section');
const previewImage = document.getElementById('preview-image');
const transcriptionSection = document.getElementById('transcription-section');
const transcriptionText = document.getElementById('transcription-text');
const saveBtn = document.getElementById('save-btn');
const exportBtn = document.getElementById('export-btn');
const savedList = document.getElementById('saved-list');
const loadingOverlay = document.getElementById('loading-overlay');
const configModal = document.getElementById('config-modal');
const saveConfigBtn = document.getElementById('save-config-btn');

// Initialize app
init();

function init() {
    loadConfig();
    setupEventListeners();
    loadSavedTranscriptions();
}

function loadConfig() {
    const savedConfig = localStorage.getItem('gotisk-config');
    if (savedConfig) {
        config = JSON.parse(savedConfig);
    }
    // Always initialize Supabase (hardcoded credentials)
    initializeSupabase();
    // Don't show config modal automatically - let users configure when they need it
}

function showConfigModal() {
    configModal.classList.add('show');

    // Pre-fill Claude API key if exists
    if (config.claudeApiKey) document.getElementById('claude-api-key').value = config.claudeApiKey;
    // Note: Supabase credentials are hardcoded, not in UI
}

function saveConfig() {
    const apiKey = document.getElementById('claude-api-key').value.trim();

    // If API key is empty, just close modal (user can configure later)
    if (!apiKey) {
        configModal.classList.remove('show');
        return;
    }

    // Validate API key format (Claude API keys start with "sk-ant-")
    if (!apiKey.startsWith('sk-ant-')) {
        alert('Ugyldig API-nøgle format. Nøglen skal starte med "sk-ant-"');
        return;
    }

    // Security warning when saving API key
    const securityWarning = `⚠️ SIKKERHEDSADVARSEL ⚠️

Din API-nøgle gemmes lokalt i browseren.

VIGTIGT:
✓ Brug IKKE på offentlige computere
✓ Luk fanen når du er færdig
✓ Sæt budget-limits i Anthropic Console
✓ Generer ny nøgle hvis computer kompromitteres

Læs mere: https://console.anthropic.com/settings/limits

Klik OK for at bekræfte at du forstår.`;

    if (!confirm(securityWarning)) {
        return;
    }

    // Save API key
    config.claudeApiKey = apiKey;
    localStorage.setItem('gotisk-config', JSON.stringify(config));
    configModal.classList.remove('show');

    alert('✓ API-nøgle gemt! Du kan nu transskribere dokumenter.');
}

function initializeSupabase() {
    if (config.supabaseUrl && config.supabaseKey && typeof supabase === 'undefined') {
        // Load Supabase library
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = () => {
            supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
            console.log('Supabase initialized');
        };
        document.head.appendChild(script);
    }
}

function setupEventListeners() {
    // Upload area
    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            const fileType = detectFileType(file);
            if (fileType === 'pdf') {
                handlePDFUpload(file);
            } else if (fileType === 'image') {
                handleImageUpload(file);
            } else {
                alert('Kun billeder (JPG, PNG) og PDF-filer understøttes');
            }
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const fileType = detectFileType(file);
            if (fileType === 'pdf') {
                handlePDFUpload(file);
            } else if (fileType === 'image') {
                handleImageUpload(file);
            } else {
                alert('Kun billeder (JPG, PNG) og PDF-filer understøttes');
            }
        }
    });

    // Buttons
    transcribeBtn.addEventListener('click', transcribeImage);
    saveBtn.addEventListener('click', saveTranscription);
    exportBtn.addEventListener('click', exportTranscription);
    saveConfigBtn.addEventListener('click', saveConfig);

    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', showConfigModal);
    }

    // Close config modal button
    const closeConfigBtn = document.getElementById('close-config-btn');
    if (closeConfigBtn) {
        closeConfigBtn.addEventListener('click', () => {
            configModal.classList.remove('show');
        });
    }

    // PDF Processing buttons
    const pdfProcessFirstBtn = document.getElementById('pdf-process-first-btn');
    const pdfProcessAllBtn = document.getElementById('pdf-process-all-btn');
    const pdfCancelBtn = document.getElementById('pdf-cancel-btn');

    if (pdfProcessFirstBtn) {
        pdfProcessFirstBtn.addEventListener('click', processPDFFirstPage);
    }

    if (pdfProcessAllBtn) {
        pdfProcessAllBtn.addEventListener('click', processPDFAll);
    }

    if (pdfCancelBtn) {
        pdfCancelBtn.addEventListener('click', cancelPDFProcessing);
    }
}

function handleImageUpload(file) {
    currentFile = file;
    processingType = 'image';

    // Check file size and compress if needed
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes

    if (file.size > maxSize) {
        console.log(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds 5MB. Compressing...`);
        compressImage(file);
    } else {
        loadImage(file);
    }
}

function loadImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        currentImageData = e.target.result;
        previewImage.src = currentImageData;
        previewSection.style.display = 'block';
        transcribeBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

function compressImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Create canvas for compression
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Calculate new dimensions (max 4000px on longest side for quality)
            let width = img.width;
            let height = img.height;
            const maxDimension = 4000;

            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = (height / width) * maxDimension;
                    width = maxDimension;
                } else {
                    width = (width / height) * maxDimension;
                    height = maxDimension;
                }
            }

            canvas.width = width;
            canvas.height = height;

            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);

            // Try different quality levels until under 5MB
            let quality = 0.9;
            let compressedDataUrl;

            do {
                compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                const compressedSize = (compressedDataUrl.length * 3) / 4; // Approximate size

                if (compressedSize < 5 * 1024 * 1024) break;
                quality -= 0.1;
            } while (quality > 0.3);

            console.log(`Compressed to quality ${quality.toFixed(1)}, new size: ~${((compressedDataUrl.length * 3) / 4 / 1024 / 1024).toFixed(2)}MB`);

            // Use compressed image
            currentImageData = compressedDataUrl;
            previewImage.src = compressedDataUrl;
            previewSection.style.display = 'block';
            transcribeBtn.disabled = false;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function transcribeImage() {
    if (!currentImageData) return;

    // Check if API key is configured
    if (!config.claudeApiKey) {
        alert('Claude API-nøgle mangler. Klik på ⚙️ indstillinger (øverst til højre) for at konfigurere din API-nøgle.\n\nSe vejledning: https://console.anthropic.com/settings/keys');
        return;
    }

    showLoading(true);

    try {
        // Prepare image for Claude API
        const base64Image = currentImageData.split(',')[1];
        const mimeType = currentFile.type;

        // Call Claude Vision API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.claudeApiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mimeType,
                                data: base64Image
                            }
                        },
                        {
                            type: 'text',
                            text: getEnhancedTranscriptionPrompt()
                        }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        const transcription = data.content[0].text;

        // Display transcription
        currentTranscription = transcription;
        transcriptionText.value = transcription;
        transcriptionSection.style.display = 'block';

    } catch (error) {
        console.error('Transcription error:', error);
        alert('Fejl ved transskription: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// ======================
// PDF PROCESSING
// ======================

async function handlePDFUpload(file) {
    console.log('PDF selected:', file.name);
    currentPDFFile = file;
    processingType = 'pdf';

    // Hide image sections, show PDF sections
    previewSection.style.display = 'none';
    transcriptionSection.style.display = 'none';
    document.getElementById('pdf-metadata-section').style.display = 'block';

    // Update upload area feedback
    const uploadPlaceholder = uploadArea.querySelector('.upload-placeholder p');
    if (uploadPlaceholder) {
        uploadPlaceholder.textContent = `📄 ${file.name} valgt - se information nedenfor`;
    }

    try {
        // Load PDF metadata
        await loadPDFMetadata(file);
    } catch (error) {
        console.error('Failed to load PDF:', error);
        alert(`Kunne ikke indlæse PDF: ${error.message}`);
    }
}

async function loadPDFMetadata(file) {
    // Check for API key
    const apiKey = localStorage.getItem('claudeApiKey') || config.claudeApiKey;
    if (!apiKey) {
        alert('Claude API-nøgle mangler! Klik på ⚙️ Indstillinger for at tilføje din nøgle.');
        throw new Error('No API key configured');
    }

    console.log('Loading PDF metadata...');
    showLoading(true, 'Indlæser PDF metadata...');

    try {
        // Create PDFBatchProcessor instance
        currentPDFProcessor = new PDFBatchProcessor(file, {
            scale: 2.0,
            sectionsPerPage: 8,
            onProgress: (progress) => {
                // Optional: fine-grained progress
            },
            onSectionComplete: (data) => {
                updatePDFProgress(data);
            },
            onPageComplete: (data) => {
                console.log(`✓ Side ${data.page} færdig`);
            },
            onError: (error) => {
                console.error('PDF processing error:', error);
                const preview = document.getElementById('pdf-preview');
                if (preview) {
                    preview.innerHTML += `\n<span style="color: #e74c3c;">[FEJL på side ${error.page}, sektion ${error.section}]</span>`;
                }
            }
        });

        // Load metadata
        const metadata = await currentPDFProcessor.load();

        console.log('PDF metadata loaded:', metadata);

        // Display metadata in UI
        document.getElementById('pdf-filename').textContent = file.name;
        document.getElementById('pdf-pages').textContent = metadata.totalPages;
        document.getElementById('pdf-sections').textContent = metadata.totalSections;
        document.getElementById('pdf-time').textContent = metadata.estimatedTimeMinutes;
        document.getElementById('pdf-cost').textContent = metadata.estimatedCostDKK;

        showLoading(false);

    } catch (error) {
        showLoading(false);
        throw error;
    }
}

async function processPDFFirstPage() {
    if (!currentPDFProcessor) {
        alert('Ingen PDF indlæst');
        return;
    }

    console.log('Processing first page only...');

    // Show loading with PDF progress UI
    showLoading(true, 'Behandler første side...');
    document.getElementById('pdf-progress-ui').style.display = 'block';
    document.getElementById('pdf-total-pages').textContent = '1';

    try {
        await currentPDFProcessor.processPage(1);

        // Get results
        const results = currentPDFProcessor.mergedResults;
        if (results && results.length > 0) {
            displayPDFResults(results);
        }

        showLoading(false);

    } catch (error) {
        console.error('Failed to process first page:', error);
        showLoading(false);
        alert(`Kunne ikke behandle første side: ${error.message}`);
    }
}

async function processPDFAll() {
    if (!currentPDFProcessor) {
        alert('Ingen PDF indlæst');
        return;
    }

    // Get metadata for confirmation
    const pages = document.getElementById('pdf-pages').textContent;
    const cost = document.getElementById('pdf-cost').textContent;
    const time = document.getElementById('pdf-time').textContent;

    // Confirm with user
    const confirmed = confirm(
        `Dette vil behandle ALLE ${pages} sider.\n\n` +
        `Estimeret tid: ${time} minutter\n` +
        `Estimeret omkostning: ${cost} kr\n\n` +
        `Fortsæt?`
    );

    if (!confirmed) return;

    console.log('Processing all pages...');

    // Show loading with PDF progress UI
    showLoading(true, 'Behandler alle sider...');
    document.getElementById('pdf-progress-ui').style.display = 'block';
    document.getElementById('pdf-total-pages').textContent = pages;

    try {
        const results = await currentPDFProcessor.processAll();

        console.log(`All pages processed! Total: ${results.length} pages`);

        displayPDFResults(results);

        showLoading(false);

        // Success notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('PDF Transskription Færdig!', {
                body: `${results.length} sider behandlet`,
                icon: '/favicon.ico'
            });
        }

    } catch (error) {
        console.error('Failed to process all pages:', error);
        showLoading(false);
        alert(`Kunne ikke behandle alle sider: ${error.message}`);
    }
}

function updatePDFProgress(data) {
    // Update progress bar
    const percent = Math.round((data.currentSection / data.totalSections) * 100);
    document.getElementById('pdf-progress-bar').style.width = `${percent}%`;
    document.getElementById('pdf-progress-percent').textContent = `${percent}%`;

    // Update counters
    document.getElementById('pdf-current-page').textContent = data.page;
    document.getElementById('pdf-current-section').textContent = data.section;

    // Update live preview (last ~10 lines)
    if (data.latestTranscription) {
        const lines = data.latestTranscription.split('\n').slice(-10);
        const preview = document.getElementById('pdf-preview');
        if (preview) {
            preview.textContent = lines.join('\n');
            preview.scrollTop = preview.scrollHeight;
        }
    }
}

function displayPDFResults(results) {
    // Format as Markdown
    let markdown = `# Gotisk Transskription\n\n`;
    markdown += `**Fil**: ${currentPDFFile.name}\n`;
    markdown += `**Transskriberet**: ${new Date().toLocaleDateString('da-DK')}\n`;
    markdown += `**Total sider**: ${results.length}\n\n`;
    markdown += `---\n\n`;

    results.forEach(pageResult => {
        markdown += `## Side ${pageResult.page}\n\n`;
        markdown += `**Linjer**: ${pageResult.totalLines}\n\n`;
        markdown += pageResult.transcription;
        markdown += `\n\n---\n\n`;
    });

    // Show in transcription section
    transcriptionSection.style.display = 'block';
    transcriptionText.value = markdown;

    // Update export button text
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.textContent = 'Download Markdown';
    }

    console.log('Results displayed in transcription section');
}

function cancelPDFProcessing() {
    if (currentPDFProcessor) {
        currentPDFProcessor.cancel();
        showLoading(false);
        alert('PDF behandling annulleret');
    }
}

// Original prompt function (kept as fallback)
function getTranscriptionPrompt() {
    return `Du skal transskribere dette gotiske/fraktur dokument fra 1600-tallets dansk til moderne danske bogstaver.

KRITISK: Dette er en TRANSSKRIPTION, IKKE en oversættelse eller fortolkning!
- Transskribér bogstav for bogstav hvad du SER
- Omstrukturér IKKE teksten
- Fortolk IKKE teksten
- Modernisér IKKE stavning
- Hvis du ikke kan genkende et bogstav: brug [?]

ABSOLUTTE REGLER:
1. Langt s (ſ) → s (moderne s)
2. Dobbelt langt s (ſſ) → ss
3. s + langt s (sſ) → ss
4. Bevar ALLE historiske stavemåder NØJAGTIGT - modernisér IKKE
5. Ligaturer (ch, ck, ff, fi, fl, ll, si, sk, sl, ss, st, sz) → bevar som separate bogstaver
6. Bevar æ, ø, å (eller aa i historiske tekster)
7. Bemærk: Mange bogstaver findes i flere varianter (elegante, dekorative, eller position-baserede former). Transskribér til samme moderne bogstav uanset variant.
8. Ulæselige/uklare bogstaver: marker med [?]
9. Dette er en 1:1 transskription - INGEN omformulering eller "rettelser"

BEVAR HISTORISK STAVNING (eksempler):
- "hafde" → IKKE "havde"
- "hand" → IKKE "han"
- "dend" → IKKE "den"
- "giøre" → IKKE "gøre"
- "kand" → IKKE "kan"
- "blef" → IKKE "blev"
- "Aar" → IKKE "år"
- "Kiøbenhafn" → IKKE "København"

FORMATTERING:
- [HEADER: ...] for overskrifter
- [PAGE: X] for sidenumre
- [SIDENOTE: ...] for marginalnoter
- Bevar linjeskift som i originalen

KRITISKE PRINCIPPER:
1. LÆS bogstav for bogstav - transskribér PRÆCIS hvad du ser
2. Marker ulæselige bogstaver med [?] - gæt ALDRIG
3. Bevar ALLE fejl, mærkelige stavemåder og uregelmæssigheder fra originalen
4. Omstrukturér IKKE sætninger - bevar nøjagtig ordrækkefølge
5. Dette er IKKE oversættelse - dette er karakter-for-karakter transskription

HUSK: Din opgave er at være et præcist OCR-værktøj, ikke en intelligent oversætter. Kun konverter gotiske bogstaver til moderne ækvivalenter - ændre INTET andet.`;
}

// Enhanced prompt with training data (200+ verified words)
function getEnhancedTranscriptionPrompt() {
    // Fallback to basic prompt if training data is not available
    if (typeof GOTHIC_TRAINING_DATA === 'undefined') {
        console.warn('Training data not loaded, using basic prompt');
        return getTranscriptionPrompt();
    }

    let prompt = `Du skal transskribere dette gotiske/fraktur dokument fra 1600-tallets dansk til moderne danske bogstaver.

KRITISK: Dette er en TRANSSKRIPTION, IKKE en oversættelse eller fortolkning!
- Transskribér bogstav for bogstav hvad du SER
- Omstrukturér IKKE teksten
- Fortolk IKKE teksten
- Modernisér IKKE stavning
- Hvis du ikke kan genkende et bogstav: brug [?]

ABSOLUTTE REGLER:
1. Langt s (ſ) → s (moderne s)
2. Dobbelt langt s (ſſ) → ss
3. s + langt s (sſ) → ss
4. Bevar ALLE historiske stavemåder NØJAGTIGT - modernisér IKKE
5. Ligaturer (ch, ck, ff, fi, fl, ll, si, sk, sl, ss, st, sz) → bevar som separate bogstaver
6. Bevar æ, ø, å (eller aa i historiske tekster)
7. Bemærk: Mange bogstaver findes i flere varianter (elegante, dekorative, eller position-baserede former). Transskribér til samme moderne bogstav uanset variant.
8. Ulæselige/uklare bogstaver: marker med [?]
9. Dette er en 1:1 transskription - INGEN omformulering eller "rettelser"

VERIFICEREDE ORD FRA HISTORISKE DOKUMENTER (Kong Christian den Fierdes Historie):
Disse ord er bekræftet fra 1600-tals tekster. Brug dem som VEJLEDNING for korrekt stavning, men TVING IKKE dem ind hvis teksten viser noget andet.

Almindelige ord: ${GOTHIC_TRAINING_DATA.commonWords.join(', ')}

Verber (bevar historisk stavning): ${GOTHIC_TRAINING_DATA.verbs.join(', ')}

Substantiver: ${GOTHIC_TRAINING_DATA.nouns.join(', ')}

Egennavne: ${GOTHIC_TRAINING_DATA.properNames.join(', ')}

Adjektiver: ${GOTHIC_TRAINING_DATA.adjectives.join(', ')}

Geografiske stednavne: ${GOTHIC_TRAINING_DATA.geographic.join(', ')}

Titler og roller: ${GOTHIC_TRAINING_DATA.titles.join(', ')}

Diplomatiske termer: ${GOTHIC_TRAINING_DATA.diplomaticTerms.join(', ')}

LANGT S (ſ) MØNSTRE - EKSEMPLER FRA VERIFICEREDE TEKSTER:
`;

    // Add long s pattern examples
    GOTHIC_TRAINING_DATA.longSPatterns.forEach(p => {
        prompt += `- ${p.gothic} → ${p.modern}\n`;
    });

    prompt += `
ALMINDELIGE FRASER I 1600-TALS TEKSTER:
${GOTHIC_TRAINING_DATA.phrases.map(p => `- "${p}"`).join('\n')}

MARGINALNOTER (almindelige mønstre):
${GOTHIC_TRAINING_DATA.marginalNotes.map(p => `- "${p}"`).join('\n')}

SJÆLDNE OG KOMPLEKSE ORD (fra verificerede oversættelser):
Disse ord er særligt udfordrende og kommer fra professionelle oversættelser af originale 1600-tals manuskripter:
${GOTHIC_TRAINING_DATA.rareWords.join(', ')}

EKSEMPEL-SÆTNINGER (few-shot learning fra verificerede parallel-tekster):
Her er komplette sætninger fra originale 1600-tals dokumenter som reference for korrekt transskription:

1. "${GOTHIC_TRAINING_DATA.exampleSentences[0]}"

2. "${GOTHIC_TRAINING_DATA.exampleSentences[1]}"

3. "${GOTHIC_TRAINING_DATA.exampleSentences[2]}"

4. "${GOTHIC_TRAINING_DATA.exampleSentences[3]}"

5. "${GOTHIC_TRAINING_DATA.exampleSentences[4]}"

Bemærk i eksemplerne:
- Konsistent brug af historisk stavning (hafde, dend, hand, giorde, blef)
- Langt s (ſ) konverteret til moderne s
- Kompleks sætningsstruktur bevaret nøjagtigt
- Rare og ældre ord transskriberet præcist uden modernisering

FORMATTERING:
- [HEADER: ...] for overskrifter
- [PAGE: X] for sidenumre
- [SIDENOTE: ...] for marginalnoter
- Bevar linjeskift som i originalen

KRITISKE PRINCIPPER FOR TRANSSKRIPTION:
1. LÆS bogstav for bogstav - transskribér PRÆCIS hvad du ser
2. Verificerede ord er kun VEJLEDNING - hvis teksten viser andet, følg teksten
3. Marker ulæselige bogstaver med [?] - gæt ALDRIG
4. Bevar ALLE fejl, mærkelige stavemåder og uregelmæssigheder fra originalen
5. Omstrukturér IKKE sætninger - bevar nøjagtig ordrækkefølge
6. Dette er IKKE oversættelse - dette er karakter-for-karakter transskription
7. AI'en skal fungere som en nøjagtig SCANNER, ikke som en fortolker

HUSK: Din opgave er at være et præcist OCR-værktøj, ikke en intelligent oversætter. Kun konverter gotiske bogstaver til moderne ækvivalenter - ændre INTET andet.`;

    return prompt;
}

async function saveTranscription() {
    if (!currentTranscription) return;

    const editedText = transcriptionText.value;

    // Save to Supabase if available
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('transcriptions')
                .insert([
                    {
                        filename: currentFile.name,
                        original_text: currentTranscription,
                        edited_text: editedText,
                        image_data: currentImageData,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (error) throw error;

            alert('Transskription gemt til database!');
            loadSavedTranscriptions();
        } catch (error) {
            console.error('Save error:', error);
            alert('Fejl ved gemning til database. Gemmer lokalt i stedet.');
            saveLocally(editedText);
        }
    } else {
        saveLocally(editedText);
    }
}

function saveLocally(text) {
    const saved = JSON.parse(localStorage.getItem('saved-transcriptions') || '[]');
    saved.push({
        id: Date.now(),
        filename: currentFile.name,
        text: text,
        imageData: currentImageData,
        date: new Date().toISOString()
    });
    localStorage.setItem('saved-transcriptions', JSON.stringify(saved));
    alert('Transskription gemt lokalt!');
    loadSavedTranscriptions();
}

function exportTranscription() {
    const text = transcriptionText.value;
    if (!text) return;

    let filename, mimeType;

    if (processingType === 'pdf') {
        filename = `transskription_${currentPDFFile.name.replace(/\.[^/.]+$/, '')}.md`;
        mimeType = 'text/markdown;charset=utf-8';
    } else {
        filename = `transskription_${currentFile.name.replace(/\.[^/.]+$/, '')}.txt`;
        mimeType = 'text/plain;charset=utf-8';
    }

    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

async function loadSavedTranscriptions() {
    savedList.innerHTML = '';

    // Try Supabase first
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('transcriptions')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                data.forEach(item => {
                    displaySavedItem({
                        id: item.id,
                        filename: item.filename,
                        text: item.edited_text,
                        imageData: item.image_data,
                        date: item.created_at,
                        source: 'supabase'
                    });
                });
                return;
            }
        } catch (error) {
            console.error('Load error:', error);
        }
    }

    // Fallback to local storage
    const saved = JSON.parse(localStorage.getItem('saved-transcriptions') || '[]');
    if (saved.length > 0) {
        saved.reverse().forEach(item => {
            displaySavedItem({
                id: item.id,
                filename: item.filename,
                text: item.text,
                imageData: item.imageData,
                date: item.date,
                source: 'local'
            });
        });
    } else {
        savedList.innerHTML = '<p class="empty-state">Ingen gemte transskriptioner endnu</p>';
    }
}

function displaySavedItem(item) {
    const div = document.createElement('div');
    div.className = 'saved-item';

    const date = new Date(item.date);
    const dateStr = date.toLocaleDateString('da-DK') + ' ' + date.toLocaleTimeString('da-DK');

    const preview = item.text.substring(0, 150) + (item.text.length > 150 ? '...' : '');

    div.innerHTML = `
        <div class="saved-item-header">
            <div class="saved-item-title">${item.filename}</div>
            <div class="saved-item-date">${dateStr}</div>
        </div>
        <div class="saved-item-preview">${preview}</div>
        <div class="saved-item-actions">
            <button class="btn btn-secondary btn-load">Indlæs</button>
            <button class="btn btn-secondary btn-download">Download</button>
            <button class="btn btn-danger btn-delete">Slet</button>
        </div>
    `;

    // Event listeners
    div.querySelector('.btn-load').addEventListener('click', () => loadItem(item));
    div.querySelector('.btn-download').addEventListener('click', () => downloadItem(item));
    div.querySelector('.btn-delete').addEventListener('click', () => deleteItem(item));

    savedList.appendChild(div);
}

function loadItem(item) {
    currentFile = { name: item.filename };
    currentImageData = item.imageData;
    currentTranscription = item.text;

    previewImage.src = item.imageData;
    previewSection.style.display = 'block';
    transcriptionText.value = item.text;
    transcriptionSection.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function downloadItem(item) {
    const blob = new Blob([item.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.filename.replace(/\.[^/.]+$/, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

async function deleteItem(item) {
    if (!confirm('Er du sikker på du vil slette denne transskription?')) return;

    if (item.source === 'supabase' && supabase) {
        try {
            const { error } = await supabase
                .from('transcriptions')
                .delete()
                .eq('id', item.id);

            if (error) throw error;
        } catch (error) {
            console.error('Delete error:', error);
            alert('Fejl ved sletning fra database');
            return;
        }
    } else {
        const saved = JSON.parse(localStorage.getItem('saved-transcriptions') || '[]');
        const filtered = saved.filter(s => s.id !== item.id);
        localStorage.setItem('saved-transcriptions', JSON.stringify(filtered));
    }

    loadSavedTranscriptions();
}

function showLoading(show, message = 'Transskriberer dokument...') {
    loadingOverlay.style.display = show ? 'flex' : 'none';
    const loadingText = document.getElementById('loading-text');
    if (loadingText) {
        loadingText.textContent = message;
    }

    // Hide PDF progress UI when hiding loading overlay
    if (!show) {
        const pdfProgressUI = document.getElementById('pdf-progress-ui');
        if (pdfProgressUI) {
            pdfProgressUI.style.display = 'none';
        }
    }
}
