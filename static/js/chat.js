//this is element initialization: this grabs all the html nodes related to the chat ui when the dom loads, and it assigns them to variables, and this is why we do it like this to avoid querying the dom repeatedly later
document.addEventListener('DOMContentLoaded', function() {
    var aiInput = document.getElementById('aiInput');
    var aiSendBtn = document.getElementById('aiSendBtn');
    var chatHistory = document.getElementById('chatHistory');
    var chatWindow = document.getElementById('aiChatWindow');
    var chatHeader = chatWindow.querySelector('.chat-header');
    var minimizeBtn = document.getElementById('minimizeBtn');
    var genReportBtn = document.getElementById('genReportBtn'); 

    //this is scroll management: this forces the chat history div to smoothly scroll down to its maximum height, and we call it after appending html, and this is why we do it like this so the user never has to scroll manually to see a new message
    function scrollToBottom() {
        chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
    }

    //this is message rendering: this creates a new div element with dynamic classes based on sender and injects it into the dom, and this is why we do it like this to keep user and ai bubbles visually distinct
    function appendMessage(text, sender) {
        var msgDiv = document.createElement('div');
        msgDiv.className = 'msg ' + (sender === 'user' ? 'user-msg' : 'ai-msg');
        msgDiv.innerHTML = text; 
        chatHistory.appendChild(msgDiv);
        scrollToBottom(); 
    }

    //this is ai query execution: this sends the user text to the flask backend via fetch and parses the returned markdown, and it handles loading states, and this is why we do it like this so the page never reloads while waiting for ai logic
    function sendQuery() {
        var query = aiInput.value.trim();
        // edge case: immediately exit function if user sent empty string
        if (!query) return;

        appendMessage(query, 'user');
        aiInput.value = '';
        
        var loadingId = 'loading-' + Date.now();
        var loadingDiv = document.createElement('div');
        loadingDiv.id = loadingId;
        loadingDiv.className = 'msg ai-msg';
        loadingDiv.innerHTML = '<i>thinking...</i>';
        chatHistory.appendChild(loadingDiv);
        scrollToBottom();
        
        fetch('/api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query })
        })
        .then(res => res.json())
        .then(data => {
            // edge case: ensure loader actually exists before trying to delete it
            var loader = document.getElementById(loadingId);
            if(loader) loader.remove();
            
            if (data.error) {
                appendMessage("error: " + data.error, 'ai');
            } else {
                var formattedAnswer = marked.parse(String(data.answer));
                appendMessage(formattedAnswer, 'ai');
            }
        })
        .catch(err => {
            var loader = document.getElementById(loadingId);
            if(loader) loader.remove();
            appendMessage("connection error. is the server running?", 'ai');
        });
    }

    if(aiSendBtn) aiSendBtn.addEventListener('click', sendQuery);
    if(aiInput) aiInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendQuery(); });

    //this is report generation logic: this gets the dashboard country dropdown value and calls the report api, and it wraps the result in a formal report class, and this is why we do it like this so the generated document looks distinctly different from standard chat text
    if(genReportBtn) {
        genReportBtn.addEventListener('click', function() {
            var country = document.getElementById('countrySelect').value;
            
            // edge case: prevent api call and alert user if they haven't picked a country yet
            if (!country) {
                appendMessage("please select a country in the dashboard first so i know which region to report on!", 'ai');
                return;
            }

            appendMessage(`generating formal policy brief for ${country}...`, 'ai');
            
            var loadingId = 'loading-report-' + Date.now();
            var loadingDiv = document.createElement('div');
            loadingDiv.id = loadingId;
            loadingDiv.className = 'msg ai-msg';
            loadingDiv.innerHTML = '<i>drafting brief...</i>';
            chatHistory.appendChild(loadingDiv);
            scrollToBottom();

            fetch('/api/generate_report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ country: country })
            })
            .then(res => res.json())
            .then(data => {
                var loader = document.getElementById(loadingId);
                if(loader) loader.remove();

                if(data.error) {
                    appendMessage("error generating report: " + data.error, 'ai');
                } else {
                    var reportHtml = `<div class="formal-report">` + marked.parse(data.report_md) + `</div>`;
                    appendMessage(reportHtml, 'ai');
                }
            })
            .catch(err => {
                var loader = document.getElementById(loadingId);
                if(loader) loader.remove();
                console.error("report generation error:", err);
                appendMessage("failed to generate the report. check server logs.", 'ai');
            });
        });
    }

    //this is draggable window logic: this tracks mouse coordinates when clicking the header to update absolute positioning, and it prevents text highlighting, and this is why we do it like this so users can move the chat out of the way of the data graphs
    var isDragging = false, dragX = 0, dragY = 0;

    chatHeader.addEventListener('mousedown', (e) => {
        // edge case: prevent the dragging routine from firing if the user actually clicked the minimize or report buttons
        if(e.target === minimizeBtn || e.target.closest('#genReportBtn')) return;
        
        isDragging = true;
        var rect = chatWindow.getBoundingClientRect();
        dragX = e.clientX - rect.left;
        dragY = e.clientY - rect.top;
        document.body.style.userSelect = 'none'; 
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        var x = e.clientX - dragX;
        var y = e.clientY - dragY;
        chatWindow.style.left = x + 'px';
        chatWindow.style.top = y + 'px';
        chatWindow.style.bottom = 'auto'; 
        chatWindow.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.userSelect = '';
    });

    //this is minimize logic: this toggles the minimized css class to collapse the window, and it swaps the button icon, and this is why we do it like this to let users hide the chat temporarily without losing their conversation history
    if(minimizeBtn) {
        minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chatWindow.classList.toggle('minimized');
            minimizeBtn.innerHTML = chatWindow.classList.contains('minimized') ? '&#9633;' : '&minus;';
        });
    }
});