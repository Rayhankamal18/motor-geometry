"""
Entry WSGI untuk PythonAnywhere / host WSGI lain.
Pastikan folder proyek ini ada di sys.path (biasanya otomatis jika wsgi.py di root repo).
"""
from run import app as application
