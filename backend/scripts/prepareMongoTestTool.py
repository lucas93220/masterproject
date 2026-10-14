"""Télécharger un outil de test macOS ARM64 dans /private/tmp, sans installation.

Source : archive MongoDB officielle 8.0.16 ; SHA256 publié vérifié le 13/10/2026.
La sortie standard contient uniquement le chemin du binaire pour FITS_TEST_MONGOD.
"""
import hashlib
import pathlib
import platform
import shutil
import tarfile
import tempfile
import urllib.request

URL = 'https://fastdl.mongodb.org/osx/mongodb-macos-arm64-8.0.16.tgz'
SHA256 = 'c2e51c6f24ec7e251816bdc7121fdbb3278490ba3709258817aa9d62baa7c660'


def main():
    if platform.system() != 'Darwin' or platform.machine() != 'arm64':
        raise SystemExit('Ce téléchargement est réservé à macOS ARM64 ; fournir sinon un mongod local compatible.')
    root = pathlib.Path(tempfile.mkdtemp(prefix='fits-mongo-tool-', dir='/private/tmp'))
    try:
        archive = root / 'mongodb.tgz'
        with urllib.request.urlopen(URL, timeout=30) as response, archive.open('wb') as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        with archive.open('rb') as content:
            if hashlib.file_digest(content, 'sha256').hexdigest() != SHA256:
                raise ValueError('Archive MongoDB différente de la version vérifiée')
        with tarfile.open(archive) as content:
            content.extractall(root, filter='data')
        print(next(root.glob('*/bin/mongod')))
    except BaseException:
        shutil.rmtree(root)
        raise


if __name__ == '__main__':
    main()
