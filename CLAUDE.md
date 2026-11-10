Help create mock exams for Esri's ArcGIS.  

Create a simple html app to help study for exams. Show a question with four multi-choice answers that the user can choose from. Show the question and the answers, let them choose an answer and click submit to see if right or wrong. Then also display a short summary of the correct answer and the authoratative source where it comes from.

Only show one question at a time, provide a NEXT button to move onto the next question.

The idea is to have one overarching HTML file, which has links to different exams. Click onto an exam takes you to a page where there would be links to bundles of questions. So an exam is kind of like a collection of bundles of questions. Have 20 questions in each bundle.

How it works: one question at a time, with a Next button. Your score shows at the top along with a progress bar. At the end you get a results screen listing what you missed and where to find it in the PDF.
Score: kept only while the page is open. Reloading the page resets it.
Answer order: the four answers are shuffled each time, so you can’t memorise “it’s always B”. You can also retry with the questions in a shuffled order.
Shortcuts: keys 1–4 pick an answer and Enter submits or moves on.

Store each exam "collection" in a separate json file. This makes extending and adding more exams or bundles easier later. Have an index json file like a manifest. This means that development of the html app and any features can be separated from the exam data bundles. 

**MUST ensure that exam questions match the versions specific to the exam** Do NOT assume or guess this, look for authorative details on which versions to target. Ask the user if this information is not readily apparent.
