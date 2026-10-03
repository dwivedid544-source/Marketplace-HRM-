import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';

export const handleDownload = async (filename = "salary_slip.pdf", elementId = "printable-slip") => {
  const element = document.getElementById(elementId);
  if (!element) {
    if (window.globalShowAlert) window.globalShowAlert("Nothing to download. Please open the slip first.", "warning");
    else alert("Nothing to download. Please open the slip first.");
    return;
  }

  try {
    // Temporarily remove scroll constraints to capture full height
    const originalMaxHeight = element.style.getPropertyValue('max-height');
    const originalOverflow = element.style.getPropertyValue('overflow');
    
    element.style.setProperty('max-height', 'none', 'important');
    element.style.setProperty('overflow', 'visible', 'important');

    const imgData = await toPng(element, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      width: element.scrollWidth,
      height: element.scrollHeight,
      fontEmbedCSS: ''
    });

    // Restore original styles
    if (originalMaxHeight) element.style.setProperty('max-height', originalMaxHeight);
    else element.style.removeProperty('max-height');
    
    if (originalOverflow) element.style.setProperty('overflow', originalOverflow);
    else element.style.removeProperty('overflow');
    
    // Check if jsPDF is available correctly (sometimes it's imported differently based on build tool)
    const PDFClass = jsPDF || window.jsPDF || window.jspdf?.jsPDF;
    if (!PDFClass) throw new Error("jsPDF is not loaded correctly");
    
    const pdf = new PDFClass('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);
    
    if (window.globalShowAlert) window.globalShowAlert(`${filename} has been generated and downloaded successfully!`, 'success');
    else alert(`${filename} has been generated and downloaded successfully!`);
  } catch (error) {
    console.error("PDF Generation Error:", error);
    if (window.globalShowAlert) window.globalShowAlert("Failed to generate PDF. Error: " + (error.message || error), 'error');
    else alert("Failed to generate PDF. Error: " + (error.message || error));
  }
};

export const handlePrint = (elementId = "printable-slip") => {
  const element = document.getElementById(elementId);
  if (!element) {
    if (window.globalShowAlert) window.globalShowAlert("Nothing to print. Please open the slip first.", "warning");
    else alert("Nothing to print. Please open the slip first.");
    return;
  }

  // Use an iframe to isolate the print content from the rest of the page
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const pri = iframe.contentWindow;

  // Extract all styles from the current document to keep Tailwind formatting intact
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(style => style.outerHTML)
    .join('\n');

  pri.document.open();
  pri.document.write(`
    <html>
      <head>
        <title>Salary Slip - Print</title>
        ${styles}
        <style>
          /* Hide scrollbars and fix padding for print */
          @page { size: auto; margin: 0mm; }
          body { 
            background: white !important; 
            margin: 0; 
            padding: 20px; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          #${elementId} { 
            max-height: none !important; 
            overflow: visible !important; 
          }
        </style>
      </head>
      <body>
        ${element.outerHTML}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
              // Clean up iframe after printing
              setTimeout(function() {
                window.parent.document.body.removeChild(window.frameElement);
              }, 1000);
            }, 500); // Give fonts and styles a moment to load
          };
        </script>
      </body>
    </html>
  `);
  pri.document.close();
};
