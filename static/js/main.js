//this is initial loading screen logic: this listens for the window to finish loading assets and then fades out the custom teal loader, and this is why we do it like this so users don't see ugly unstyled elements while heavy libraries initialize
window.addEventListener('load', function() {
    const loader = document.getElementById('app-loader');
    
    setTimeout(() => {
        // edge case: check if loader div actually exists to prevent null reference errors on secondary pages
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(() => { loader.remove(); }, 800); 
        }
    }, 800); 
});

//this is tab switching logic: this loops through all view sections to hide them and removes active classes before showing the target tab, and this is why we do it like this to build a single-page application feel without needing a framework like react
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelectorAll('.view-section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    document.getElementById('tab-' + tabId).classList.add('active');
    document.getElementById('view-' + tabId).classList.add('active');
}

//this is help modal logic: this binds click events to toggle the hidden state of the popup guide overlay, and this is why we do it like this to provide immediate context to new users without taking them away from their current data view
window.addEventListener('DOMContentLoaded', function() {
    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    const closeHelpBtn = document.getElementById('closeHelpBtn');

    // edge case: verify all modal dom elements exist before attaching listeners to prevent console errors
    if (helpBtn && helpModal && closeHelpBtn) {
        helpBtn.addEventListener('click', () => { helpModal.classList.remove('hidden'); });
        closeHelpBtn.addEventListener('click', () => { helpModal.classList.add('hidden'); });
        
        helpModal.addEventListener('click', (e) => {
            // edge case: close modal only if they click the darkened background, not the white box itself
            if (e.target === helpModal) { helpModal.classList.add('hidden'); }
        });
        
        document.addEventListener('keydown', (e) => {
            // edge case: allow users to quickly exit modal using escape key for better accessibility
            if (e.key === 'Escape' && !helpModal.classList.contains('hidden')) {
                helpModal.classList.add('hidden');
            }
        });
    }
});

//this is analyzer tab logic: this handles file selection and triggers the api call to the backend, and it renders the markdown response into the dedicated results div, and this is why we do it like this to separate deep document analysis from the casual side-chat window
window.addEventListener('DOMContentLoaded', function() {
    var fileInput = document.getElementById('analyzerFileInput');
    var fileNameDisplay = document.getElementById('uploadFileName');
    var submitBtn = document.getElementById('analyzeSubmitBtn');
    var clearBtn = document.getElementById('analyzeClearBtn');
    var loadingDiv = document.getElementById('analyzerLoading');
    var resultsDiv = document.getElementById('analyzerResults');
    var uploadBox = document.getElementById('uploadBox');

    if(fileInput && submitBtn) {
        fileInput.addEventListener('change', function() {
            // edge case: debug logging to ensure browser registers the file
            console.log("file selected:", this.files); 
            
            if(this.files && this.files.length > 0) {
                if (fileNameDisplay) fileNameDisplay.textContent = "📎 " + this.files[0].name;
                submitBtn.style.display = 'inline-block';
                // edge case: check if clearbtn exists before changing its style
                if (clearBtn) clearBtn.style.display = 'inline-block'; 
                if (resultsDiv) resultsDiv.classList.add('hidden'); 
            }
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                // edge case: handle reset state explicitly so users can clear errors and start fresh
                fileInput.value = '';
                if (fileNameDisplay) fileNameDisplay.textContent = '';
                submitBtn.style.display = 'none';
                clearBtn.style.display = 'none';
                if (resultsDiv) {
                    resultsDiv.classList.add('hidden');
                    resultsDiv.innerHTML = '';
                }
            });
        }

        submitBtn.addEventListener('click', function() {
            // edge case: debug logging to track click execution
            console.log("analyze button clicked!"); 
            
            var file = fileInput.files[0];
            if(!file) {
                console.log("no file found in input.");
                return;
            }

            var formData = new FormData();
            formData.append('file', file);

            // edge case: lock the ui buttons and show the spinner so the user doesn't double-click and fire multiple api calls
            submitBtn.disabled = true;
            submitBtn.textContent = "Analyzing...";
            if (clearBtn) clearBtn.disabled = true;
            if (loadingDiv) loadingDiv.classList.remove('hidden');
            if (resultsDiv) resultsDiv.classList.add('hidden');
            if (uploadBox) uploadBox.style.opacity = '0.5';

            console.log("sending file to python backend..."); 

            fetch('/api/upload_policy', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                // edge case: debug logging to verify server response payload
                console.log("server responded!", data); 
                
                // edge case: reset ui state regardless of success or failure
                if (loadingDiv) loadingDiv.classList.add('hidden');
                submitBtn.disabled = false;
                submitBtn.textContent = "Analyze Document";
                if (clearBtn) clearBtn.disabled = false;
                if (uploadBox) uploadBox.style.opacity = '1';

                if(data.error) {
                    if (resultsDiv) resultsDiv.innerHTML = "<h3 style='color: var(--error);'>error</h3><p>" + data.error + "</p>";
                } else {
                    // edge case: pass the raw ai string into the marked.js parser to render headers and bold text properly
                    if (resultsDiv) resultsDiv.innerHTML = marked.parse(String(data.answer));
                }
                if (resultsDiv) resultsDiv.classList.remove('hidden');
            })
            .catch(err => {
                // edge case: debug logging for fetch failures
                console.error("fetch error:", err); 
                
                if (loadingDiv) loadingDiv.classList.add('hidden');
                submitBtn.disabled = false;
                submitBtn.textContent = "Analyze Document";
                if (clearBtn) clearBtn.disabled = false;
                if (uploadBox) uploadBox.style.opacity = '1';
                
                if (resultsDiv) {
                    resultsDiv.innerHTML = "<h3 style='color: var(--error);'>connection error</h3><p>failed to analyze document. check server logs.</p>";
                    resultsDiv.classList.remove('hidden');
                }
            });
        });
    }
});