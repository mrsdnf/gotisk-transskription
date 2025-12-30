/**
 * PDF Batch Processor for Gothic Transcription App
 *
 * Processes large PDF documents by:
 * 1. Splitting each page into 4 overlapping horizontal sections (top → bottom)
 * 2. Transcribing each section via Claude Vision API
 * 3. Deduplicating overlapping text automatically via AI
 * 4. Merging sections with continuous line numbering
 * 5. Outputting Markdown (.md) and optionally Word (.docx)
 *
 * @author Claude Code
 * @version 1.0
 * @date 2025-12-29
 */

/**
 * Creates overlapping horizontal sections for a canvas
 * Each section overlaps 30% with the previous section to prevent text loss
 *
 * @param {HTMLCanvasElement} canvas - Source canvas with rendered PDF page
 * @returns {Object} Layout object with sections array and metadata
 */
function createOverlappingSections(canvas) {
  const width = canvas.width;
  const height = canvas.height;

  // 4 HORISONTALE bånde fra TOP → BUND med 30% overlap
  const sectionHeight = Math.floor(height * 0.65);  // Each section: 65% of page HEIGHT
  const overlapHeight = Math.floor(height * 0.30);  // 30% overlap

  const sections = [
    {
      index: 1,
      x: 0,
      y: 0,
      width: width,           // FULL width
      height: sectionHeight,  // 65% of page height
      position: 'top',
      overlapWithPrevious: false
    },
    {
      index: 2,
      x: 0,
      y: sectionHeight - overlapHeight,  // Start with overlap
      width: width,
      height: sectionHeight,
      position: 'mid-top',
      overlapWithPrevious: true,
      overlapPixels: overlapHeight
    },
    {
      index: 3,
      x: 0,
      y: height - sectionHeight,  // Align to cover bottom
      width: width,
      height: sectionHeight,
      position: 'mid-bottom',
      overlapWithPrevious: true,
      overlapPixels: overlapHeight
    },
    {
      index: 4,
      x: 0,
      y: height - Math.floor(height * 0.35),  // Last 35% of page
      width: width,
      height: Math.floor(height * 0.35),
      position: 'bottom',
      overlapWithPrevious: true,
      overlapPixels: overlapHeight
    }
  ];

  return {
    type: 'overlapping-horizontal-bands',
    sections: sections,
    totalOverlap: overlapHeight * 3  // Total overlapping pixels across all sections
  };
}

/**
 * Extracts a section from source canvas
 *
 * @param {HTMLCanvasElement} sourceCanvas - Source canvas with full page
 * @param {Object} section - Section metadata from createOverlappingSections()
 * @returns {HTMLCanvasElement} New canvas with extracted section
 */
function extractSection(sourceCanvas, section) {
  // Create new canvas for the section
  const sectionCanvas = document.createElement('canvas');
  sectionCanvas.width = section.width;
  sectionCanvas.height = section.height;

  const ctx = sectionCanvas.getContext('2d');

  // Copy HORIZONTAL section from source canvas (including overlap area)
  ctx.drawImage(
    sourceCanvas,
    section.x, section.y, section.width, section.height,  // source (with overlap)
    0, 0, section.width, section.height                    // destination
  );

  return sectionCanvas;
}

/**
 * Generates overlap context for AI deduplication
 *
 * @param {Array} sections - Array of section metadata
 * @param {Number} currentSectionIndex - Current section index (1-based)
 * @param {Array} previousTranscriptions - Array of previous section transcriptions
 * @returns {Object} Overlap context with instructions for Claude
 */
function getOverlapContext(sections, currentSectionIndex, previousTranscriptions) {
  if (currentSectionIndex === 1) {
    // First section: no overlap
    return {
      hasOverlap: false,
      overlapInstructions: ""
    };
  }

  // Get last ~10 lines from previous section (overlap area)
  const previousTranscription = previousTranscriptions[currentSectionIndex - 2];
  const previousLines = previousTranscription.split('\n').slice(-10);

  return {
    hasOverlap: true,
    overlapPixels: sections[currentSectionIndex - 1].overlapPixels,
    previousSectionLastLines: previousLines,
    overlapInstructions: `
KRITISK OVERLAP HÅNDTERING:
Denne sektion OVERLAPPER med forrige sektion.

De sidste ~10 linjer fra forrige sektion var:
${previousLines.map((line, i) => `${i + 1}. ${line}`).join('\n')}

DIN OPGAVE:
1. IGNORER disse linjer hvis de også findes i dette billede
2. Start transskription fra FØRSTE NYE linje efter overlap-området
3. Marker ikke overlap-linjer i din output
4. Kun transskribér NYE linjer der IKKE var i forrige sektion
`
  };
}

/**
 * Generates section-aware transcription prompt
 *
 * @param {Object} sectionInfo - Section metadata
 * @param {Object} overlapContext - Overlap context from getOverlapContext()
 * @returns {String} Enhanced prompt for Claude Vision
 */
function getTranscriptionPromptForSection(sectionInfo, overlapContext) {
  let prompt = `
🚨 KRITISK: BOGSTAV-FOR-BOGSTAV TRANSSKRIPTION - INGEN FORTOLKNING! 🚨

Du transskriberer SEKTION ${sectionInfo.sectionNumber} af 4 fra side ${sectionInfo.pageNumber}.
Dette er ${sectionInfo.position} HORISONTALT bånd af siden (top → bund).

${overlapContext.hasOverlap ? overlapContext.overlapInstructions : ''}

⚠️ DIN ROLLE: Du er et SIMPELT OCR-SCANNER-VÆRKTØJ - IKKE en intelligent assistent!
- Du må IKKE "hjælpe" ved at rette, forbedre eller modernisere teksten
- Du må IKKE "genkende ord" og auto-rette stavning
- Du må IKKE "gætte" hvad der "burde" stå
- Du skal SLAVISK kopiere præcis hvad du ser, bogstav for bogstav

⚠️ ABSOLUTTE REGLER FOR TRANSSKRIPTION:

🔤 BOGSTAVER:
1. Transskribér BOGSTAV FOR BOGSTAV hvad du SER - INGEN fortolkning!
2. Bevar NØJAGTIG kapitalisering (Store/små bogstaver som i originalen)
3. Modernisér IKKE stavning (bevar "hafde", "dend", "blef", "giorde", "hand", "udi", "saae", osv.)
4. Hvis et bogstav er ulæseligt eller usikkert: brug [?] for det bogstav - gæt ALDRIG

📝 ORD OG STAVNING:
5. Tilføj IKKE ord der ikke står i teksten
6. Ret IKKE "fejl" i stavning - bevar alt nøjagtigt som skrevet
7. Omstrukturer IKKE ordrækkefølge
8. Udvid IKKE forkortelser (bevar "Dr.", "Hr.", "etc." som de står)
9. ADVARSEL: Ignorér "verificerede ord" fra træningsdata hvis teksten viser andet!

⏎ MELLEMRUM OG LINJESKIFT:
10. Bevar ALLE mellemrum præcis som i originalen (også dobbelt-mellemrum)
11. Bevar ALLE linjeskift præcis som i originalen - tilføj IKKE eller fjern IKKE linjer
12. Flyd IKKE tekst sammen over linjer

.,;:!? TEGNSÆTNING:
13. Bevar ALLE tegn nøjagtigt (komma, punktum, semikolon, kolon, bindestreg, osv.)
14. Tilføj IKKE tegnsætning der mangler
15. Ret IKKE "forkert" tegnsætning

🔢 TAL OG DATOER:
16. Bevar tal NØJAGTIGT som skrevet (romerske tal, arabertal, ordtal)
17. Modernisér IKKE tal-formatering

📄 MARGINALNOTER, OVERSKRIFTER OG SIDEHOVEDER:
18. Inkludér ALLE marginalnoter/sidenoter (små tekster i margenen) som [SIDENOTE: tekst her]
19. Placer sidenoten på SAMME linje som den hører til i hovedteksten
20. Hvis sidenote er ulæselig: [SIDENOTE: [ulæseligt]]
21. Hvis sidenote spænder over flere linjer: inkludér ALT i én [SIDENOTE: ...]
22. Inkludér ALLE overskrifter som [HEADER: tekst her]
23. Inkludér sidenummer øverst som [PAGE: nummer] (f.eks. [PAGE: 113])
24. Inkludér løbende sidehoved som [RUNNING HEADER: tekst] (ofte efter sidenummer)
25. Hvis sidehoved/sidenummer er ulæseligt: [PAGE: [?]] eller [RUNNING HEADER: [ulæseligt]]
26. Spring IKKE noget over - alt skal med (sidenummer + sidehoved + hovedtekst + sidenoter + overskrifter)

🔍 BESKADIGET TEKST:
27. Hvis tekst er beskadiget, plettet eller ulæselig: marker med [?] eller [ulæseligt]
28. Gæt ALDRIG manglende bogstaver - brug [?] for hvert manglende bogstav

LINJENUMMER-REGLER:
- Tilføj linjenummer til HVER linje i formatet: L1: [tekst], L2: [tekst], etc.
- Start linjenummerering fra L1 for denne sektion
- Bevar alle linjeskift præcis som i originalen
- Hvis en linje er tom/blank, skriv: LX: [blank]
${overlapContext.hasOverlap ? '- SPRING OVER linjer der allerede blev transskriberet i forrige sektion' : ''}

EKSEMPEL OUTPUT ${overlapContext.hasOverlap ? '(kun NYE linjer)' : ''} - bemærk historisk stavning, sidehoveder og sidenoter bevaret:
L1: [PAGE: 113]
L2: [RUNNING HEADER: Kong Christian dend Fierdes Historie]
L3: [blank]
L4: [HEADER: Kong Christian dend Fierde]
L5: Det Lys, som hidindtil hafde fremblinket af dend
L6: unge Konges høypriselige Dyder, gaf, ligesom [SIDENOTE: Kongen]
L7: Morgenrøden, tilkiende, hvor klar en Soel der
L8: [blank]
L9: nu ville opstaae og fremskinne. [SIDENOTE: Aar 1596]

Bemærk:
- Sidenummer øverst med [PAGE: nummer]
- Løbende sidehoved med [RUNNING HEADER: ...]
- Overskrift på egen linje med [HEADER: ...]
- Sidenoter sidst på linjen med [SIDENOTE: ...]
- Historisk stavning bevaret (hafde, dend, osv.)

HUSK: Din opgave er PRÆCIS TRANSSKRIPTION, ikke oversættelse eller forbedring!
`;

  return prompt;
}

/**
 * Merges and renumbers sections for a complete page
 *
 * @param {Array} sectionTranscriptions - Array of transcriptions from all sections
 * @returns {String} Merged transcription with continuous line numbering
 */
function mergeAndRenumberSections(sectionTranscriptions) {
  // Merge all sections (already deduplicated by AI)
  const allLines = [];

  sectionTranscriptions.forEach(transcription => {
    // Extract lines, strip section-specific line numbers
    const lines = transcription.split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Remove "L1: " prefix to get raw text
        const match = line.match(/^L\d+:\s*(.*)$/);
        return match ? match[1] : line;
      });

    allLines.push(...lines);
  });

  // Renumber continuously for the entire page
  const renumbered = allLines.map((line, index) => {
    return `L${index + 1}: ${line}`;
  }).join('\n');

  return renumbered;
}

/**
 * Line Number Tracker
 * Tracks line numbers across pages and sections
 */
class LineNumberTracker {
  constructor() {
    this.currentPage = 1;
    this.currentSection = 1;
    this.lineOffset = 0;
  }

  getLineNumberPrefix(lineIndex) {
    // Format: "P42-S2-L15" = Page 42, Section 2, Line 15
    return `P${this.currentPage}-S${this.currentSection}-L${lineIndex + 1}`;
  }

  formatTranscriptionWithLineNumbers(text) {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      return `${this.getLineNumberPrefix(i)}: ${line}`;
    }).join('\n');
  }

  nextSection() {
    this.currentSection++;
    this.lineOffset += 20; // Assumed ~20 lines per section
  }

  nextPage() {
    this.currentPage++;
    this.currentSection = 1;
    this.lineOffset = 0;
  }
}

/**
 * Main PDF Batch Processor
 * Orchestrates the entire PDF processing pipeline
 */
class PDFBatchProcessor {
  constructor(pdfFile, options = {}) {
    this.file = pdfFile;
    this.pdf = null;
    this.totalPages = 0;
    this.totalSections = 0;
    this.currentPage = 0;
    this.currentSection = 0;
    this.results = []; // Array of { page, section, transcription }
    this.mergedResults = []; // Array of { page, transcription, totalLines }
    this.paused = false;
    this.cancelled = false;
    this.lineTracker = new LineNumberTracker();

    this.options = {
      scale: options.scale || 2.0,           // High resolution for OCR
      sectionsPerPage: options.sectionsPerPage || 4,
      batchPauseMs: options.batchPauseMs || 100,  // Pause between pages for GC
      onProgress: options.onProgress || (() => {}),
      onSectionComplete: options.onSectionComplete || (() => {}),
      onPageComplete: options.onPageComplete || (() => {}),
      onError: options.onError || (() => {})
    };
  }

  /**
   * Load PDF and get metadata
   * @returns {Object} Metadata with totalPages, totalSections, estimates
   */
  async load() {
    console.log('Loading PDF...');
    const arrayBuffer = await this.file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    this.pdf = await loadingTask.promise;
    this.totalPages = this.pdf.numPages;
    this.totalSections = this.totalPages * this.options.sectionsPerPage;

    console.log(`PDF loaded: ${this.totalPages} pages, ${this.totalSections} sections`);
    return {
      totalPages: this.totalPages,
      totalSections: this.totalSections,
      estimatedTimeMinutes: Math.ceil(this.totalSections * 0.33), // ~20s per section
      estimatedCostUSD: Math.ceil(this.totalSections * 0.015 * 100) / 100
    };
  }

  /**
   * Process all pages in the PDF
   * @returns {Array} Array of merged results
   */
  async processAll() {
    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      if (this.cancelled) break;

      while (this.paused) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await this.processPage(pageNum);

      // Brief pause for garbage collection
      await new Promise(resolve => setTimeout(resolve, this.options.batchPauseMs));
    }

    console.log('All pages processed!');
    return this.mergedResults;
  }

  /**
   * Process a single page
   * @param {Number} pageNum - Page number (1-based)
   */
  async processPage(pageNum) {
    console.log(`Processing page ${pageNum}/${this.totalPages}...`);
    this.currentPage = pageNum;
    this.lineTracker.currentPage = pageNum;

    // 1. Render PDF page to high-res canvas
    const page = await this.pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: this.options.scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');

    await page.render({ canvasContext: context, viewport: viewport }).promise;

    // 2. Create overlapping sections (30% overlap)
    const layout = createOverlappingSections(canvas);

    // 3. Track transcriptions for overlap context
    const pageTranscriptions = [];

    // 4. Process each section SEQUENTIALLY (important for overlap context)
    for (let i = 0; i < layout.sections.length; i++) {
      if (this.cancelled) break;

      this.currentSection = i + 1;
      this.lineTracker.currentSection = i + 1;

      const section = layout.sections[i];
      const sectionCanvas = extractSection(canvas, section);

      try {
        // Convert to PNG blob (memory efficient)
        const blob = await new Promise(resolve =>
          sectionCanvas.toBlob(resolve, 'image/png', 0.9)
        );

        // Compress if needed
        const compressedBlob = await this.compressIfNeeded(blob);

        // Get overlap context from previous sections
        const overlapContext = getOverlapContext(
          layout.sections,
          i + 1,
          pageTranscriptions
        );

        // Transcribe via Claude API (with overlap deduplication)
        const transcription = await this.transcribeSection(
          compressedBlob,
          pageNum,
          i + 1,
          layout.type,
          overlapContext  // NEW: pass overlap context
        );

        // Store transcription for this section
        pageTranscriptions.push(transcription);

        // Store result
        this.results.push({
          page: pageNum,
          section: i + 1,
          transcription: transcription,
          lineNumbers: this.extractLineNumbers(transcription),
          hadOverlap: overlapContext.hasOverlap
        });

        this.options.onSectionComplete({
          page: pageNum,
          section: i + 1,
          totalPages: this.totalPages,
          totalSections: this.totalSections,
          currentSection: (pageNum - 1) * layout.sections.length + (i + 1),
          latestTranscription: transcription  // For live preview
        });

      } catch (error) {
        console.error(`Error processing page ${pageNum}, section ${i + 1}:`, error);
        console.error(`Error details:`, {
          name: error.name,
          message: error.message,
          stack: error.stack
        });

        this.options.onError({
          page: pageNum,
          section: i + 1,
          error: error,
          errorMessage: error.message || 'Unknown error',
          errorType: error.name || 'Error'
        });

        // Mark as failed but continue
        const errorDetails = error.message || 'Unknown error';
        pageTranscriptions.push(`[ERROR: Could not transcribe this section - ${errorDetails}]`);
        this.results.push({
          page: pageNum,
          section: i + 1,
          transcription: `[ERROR: Could not transcribe this section - ${errorDetails}]`,
          error: error.message,
          errorType: error.name
        });
      }

      // Cleanup section canvas
      sectionCanvas.width = 0;
      sectionCanvas.height = 0;

      this.lineTracker.nextSection();
    }

    // 5. Merge and renumber all sections for this page
    const mergedPageTranscription = mergeAndRenumberSections(pageTranscriptions);

    // Store merged result (replaces individual sections)
    // This is what goes into the final Markdown/Word document
    this.mergedResults.push({
      page: pageNum,
      transcription: mergedPageTranscription,
      totalLines: mergedPageTranscription.split('\n').length
    });

    // 6. Cleanup page canvas
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();

    this.options.onPageComplete({
      page: pageNum,
      totalPages: this.totalPages,
      mergedTranscription: mergedPageTranscription
    });

    this.lineTracker.nextPage();
  }

  /**
   * Compress image blob if it exceeds size limit
   * @param {Blob} blob - Image blob
   * @returns {Blob} Compressed blob (or original if small enough)
   */
  async compressIfNeeded(blob) {
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (blob.size <= maxSize) {
      return blob;
    }

    console.log(`Section image size (${(blob.size / 1024 / 1024).toFixed(2)}MB) exceeds 5MB. Compressing...`);

    // Convert blob to image
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(blob);
    });

    // Create image element
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

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
    ctx.drawImage(img, 0, 0, width, height);

    // Try different quality levels until under 5MB
    let quality = 0.9;
    let compressedBlob;

    do {
      compressedBlob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', quality);
      });

      if (compressedBlob.size < maxSize) break;
      quality -= 0.1;
    } while (quality > 0.3);

    console.log(`Compressed to quality ${quality.toFixed(1)}, new size: ${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB`);

    return compressedBlob;
  }

  /**
   * Transcribe a section via Claude Vision API
   * @param {Blob} imageBlob - Image blob
   * @param {Number} pageNum - Page number
   * @param {Number} sectionNum - Section number
   * @param {String} layoutType - Layout type
   * @param {Object} overlapContext - Overlap context
   * @returns {String} Transcription text
   */
  async transcribeSection(imageBlob, pageNum, sectionNum, layoutType, overlapContext) {
    // Get API key from localStorage (same as main app)
    const apiKey = localStorage.getItem('claudeApiKey');
    if (!apiKey) {
      throw new Error('Claude API Key not found. Please configure it in settings.');
    }

    // Convert blob to base64 for Claude API
    const base64 = await this.blobToBase64(imageBlob);

    // Get section-specific prompt
    const sectionPrompt = getTranscriptionPromptForSection({
      pageNumber: pageNum,
      sectionNumber: sectionNum,
      position: this.getSectionPosition(sectionNum, layoutType),
      totalSections: this.options.sectionsPerPage
    }, overlapContext);

    // Get enhanced prompt from training data (from app.js)
    const enhancedPrompt = this.getEnhancedTranscriptionPrompt();

    // Combine prompts: section instructions + enhanced prompt
    const fullPrompt = sectionPrompt + '\n\n' + enhancedPrompt;

    console.log(`Transcribing page ${pageNum}, section ${sectionNum}...`);

    // Call Claude Vision API via Netlify Function (to avoid CORS issues)
    try {
      const response = await fetch('/.netlify/functions/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: apiKey,
          image: base64,
          prompt: fullPrompt
        })
      });

      if (!response.ok) {
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
        try {
          const error = await response.json();
          errorMessage = error.error?.message || errorMessage;
          console.error('API Error Details:', error);
        } catch (e) {
          console.error('Could not parse error response');
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const transcription = data.content[0].text;

      return transcription;
    } catch (error) {
      console.error(`Transcription failed for page ${pageNum}, section ${sectionNum}:`, error);
      throw error;
    }
  }

  /**
   * Get enhanced transcription prompt (from app.js getEnhancedTranscriptionPrompt)
   * @returns {String} Enhanced prompt
   */
  getEnhancedTranscriptionPrompt() {
    // Fallback to basic prompt if training data is not available
    if (typeof GOTHIC_TRAINING_DATA === 'undefined') {
      console.warn('Training data not loaded, using basic prompt');
      return this.getBasicTranscriptionPrompt();
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
🚨 ADVARSEL: Disse ord er kun REFERENCE-EKSEMPLER fra andre dokumenter! 🚨
- Brug dem KUN som vejledning for at genkende gotiske bogstaver
- TVING DEM IKKE ind i din transskription hvis billedet viser andet
- Hvis du ser "hafde" i billedet, skriv "hafde" - selv om det ikke er på listen
- Hvis du ser "havde" i billedet, skriv "havde" - modernisér IKKE til noget andet
- FØLG ALTID BILLEDET, ALDRIG LISTEN!

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

KRITISKE PRINCIPPER FOR TRANSSKRIPTION:
1. LÆS bogstav for bogstav - transskribér PRÆCIS hvad du ser
2. Verificerede ord er kun VEJLEDNING - hvis teksten viser andet, følg teksten
3. Marker ulæselige bogstaver med [?] - gæt ALDRIG
4. Bevar ALLE fejl, mærkelige stavemåder og uregelmæssigheder fra originalen
5. Omstrukturér IKKE sætninger - bevar nøjagtig ordrækkefølge
6. Dette er IKKE oversættelse - dette er karakter-for-karakter transskription
7. AI'en skal fungere som en nøjagtig SCANNER, ikke som en fortolker

🔒 EKSTRA KRITISKE INSTRUKTIONER (DISSE ER VIGTIGST!):

✋ MELLEMRUM: Bevar alle mellemrum præcis. Tilføj IKKE ekstra mellemrum. Fjern IKKE mellemrum.

✋ TEGNSÆTNING: Bevar alle kommaer, punktummer, bindestreger PRÆCIST. Ret IKKE "manglende" tegnsætning.

✋ KAPITALISERING: Bevar store/små bogstaver PRÆCIST. Normaliser IKKE til "rigtig" kapitalisering.

✋ LINJESKIFT: Bevar ALLE linjeskift. Tilføj IKKE nye linjer. Fjern IKKE eksisterende linjer. Flyd IKKE tekst sammen.

✋ FORKORTELSER: Udvid IKKE forkortelser (som "Dr.", "Hr.", "K."). Bevar dem præcis som skrevet.

✋ TAL: Bevar tal præcis (romerske tal som "MDCXVI", arabertal som "1597", ordtal som "fierdes").

✋ MARGINALNOTER/SIDENOTER: Inkludér ALT - også små noter i margenen. Placer [SIDENOTE: tekst] på SAMME linje som hovedteksten den hører til. Hvis sidenote er ulæselig: [SIDENOTE: [ulæseligt]]. Hvis sidenote spænder over flere linjer i margenen: inkludér alt i én [SIDENOTE: ...].

✋ SIDEHOVEDER OG SIDENUMRE: Inkludér sidenummer øverst som [PAGE: nummer] (f.eks. [PAGE: 113]). Inkludér løbende sidehoved som [RUNNING HEADER: tekst] (ofte lige efter sidenummeret, før hovedteksten). Hvis ulæseligt: [PAGE: [?]] eller [RUNNING HEADER: [ulæseligt]].

✋ BESKADIGET TEKST: Brug [?] for ulæselige dele. Gæt ALDRIG hvad der "burde" stå.

✋ "VERIFICEREDE ORD"-LISTEN: Ignorér den hvis billedet viser noget andet! Billedet er ALTID korrekt, listen er kun reference.

✋ DIN ROLLE: Du er en DUM SCANNER, ikke en smart assistent. Kopiér slavisk hvad du ser - hjælp IKKE ved at "rette" eller "forbedre".

HUSK: Din opgave er at være et SIMPELT, NØJAGTIGT OCR-SCANNER-VÆRKTØJ - ikke en intelligent oversætter.
Kun konverter gotiske bogstaver til moderne ækvivalenter - ændre ABSOLUT INTET andet.
Hvis du er i tvivl om noget: BEVAR DET SOM DET ER i billedet.`;

    return prompt;
  }

  /**
   * Get basic transcription prompt (fallback)
   * @returns {String} Basic prompt
   */
  getBasicTranscriptionPrompt() {
    return `Du skal transskribere dette gotiske/fraktur dokument fra 1600-tallets dansk til moderne danske bogstaver.

REGLER:
1. Langt s (ſ) → s
2. Bevar historisk stavning
3. Marker ulæselige bogstaver med [?]
4. Dette er en 1:1 transskription - INGEN fortolkning

Transskribér præcist hvad du ser.`;
  }

  /**
   * Get section position description
   * @param {Number} sectionNum - Section number (1-4)
   * @param {String} layoutType - Layout type
   * @returns {String} Position description
   */
  getSectionPosition(sectionNum, layoutType) {
    // HORISONTALE bånd (top → bund)
    const positions = ['top', 'mid-top', 'mid-bottom', 'bottom'];
    return positions[sectionNum - 1];
  }

  /**
   * Extract line count from transcription
   * @param {String} transcription - Transcription text
   * @returns {Number} Line count
   */
  extractLineNumbers(transcription) {
    // Parse "L1: text" format to extract line count
    const lines = transcription.split('\n').filter(l => l.trim());
    return lines.length;
  }

  /**
   * Convert blob to base64 string
   * @param {Blob} blob - Image blob
   * @returns {String} Base64 string
   */
  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Pause processing
   */
  pause() {
    this.paused = true;
    console.log('PDF processing paused');
  }

  /**
   * Resume processing
   */
  resume() {
    this.paused = false;
    console.log('PDF processing resumed');
  }

  /**
   * Cancel processing
   */
  cancel() {
    this.cancelled = true;
    console.log('PDF processing cancelled');
  }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PDFBatchProcessor,
    createOverlappingSections,
    extractSection,
    getOverlapContext,
    getTranscriptionPromptForSection,
    mergeAndRenumberSections,
    LineNumberTracker
  };
}
