import zipfile
import xml.etree.ElementTree as ET
import sys

def extract_text_from_docx(docx_path):
    try:
        document = zipfile.ZipFile(docx_path)
        xml_content = document.read('word/document.xml')
        document.close()
        tree = ET.XML(xml_content)
        
        NAMESPACE = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
        PARA = NAMESPACE + 'p'
        TEXT = NAMESPACE + 't'
        
        text_lines = []
        for paragraph in tree.iter(PARA):
            texts = [node.text for node in paragraph.iter(TEXT) if node.text]
            if texts:
                text_lines.append(''.join(texts))
                
        return '\n'.join(text_lines)
    except Exception as e:
        return str(e)

if __name__ == '__main__':
    print(extract_text_from_docx(sys.argv[1]))
