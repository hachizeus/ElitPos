"""
Run all Drizzle migration SQL files directly against PostgreSQL, one at a time.
Each file gets its own connection so failures don't roll back earlier migrations.
Tracks which files succeeded via a local journal to allow resuming.
"""
import os
import subprocess
import sys

DRIZZLE_DIR = os.path.join(os.path.dirname(__file__), 'drizzle')
JOURNAL_FILE = os.path.join(os.path.dirname(__file__), '.migration_journal.txt')

PG_HOST = 'localhost'
PG_PORT = '5433'
PG_USER = 'postgres'
PG_DB   = 'retail_smart_erp'
PG_PASS = '0a0b0c0D.'

PSQL = r'C:\Program Files\PostgreSQL\17\bin\psql.exe'

def get_done():
    if not os.path.exists(JOURNAL_FILE):
        return set()
    with open(JOURNAL_FILE) as f:
        return set(line.strip() for line in f if line.strip())

def mark_done(fn):
    with open(JOURNAL_FILE, 'a') as f:
        f.write(fn + '\n')

def run_file(path):
    env = os.environ.copy()
    env['PGPASSWORD'] = PG_PASS
    result = subprocess.run(
        [PSQL, '-h', PG_HOST, '-p', PG_PORT, '-U', PG_USER, '-d', PG_DB,
         '-v', 'ON_ERROR_STOP=1', '-f', path],
        capture_output=True, text=True, env=env
    )
    return result.returncode, result.stdout, result.stderr

def main():
    # Get all numbered SQL files in order, plus special files at the end
    all_files = sorted(f for f in os.listdir(DRIZZLE_DIR) if f.endswith('.sql'))
    # Put numbered migrations first (0000-0120), then any unnumbered ones
    numbered = sorted(f for f in all_files if f[0].isdigit())
    unnumbered = sorted(f for f in all_files if not f[0].isdigit())
    files = numbered + unnumbered

    done = get_done()
    print(f'Total files: {len(files)}, Already done: {len(done)}')

    errors = []
    for fn in files:
        if fn in done:
            print(f'  SKIP (already done): {fn}')
            continue

        path = os.path.join(DRIZZLE_DIR, fn)
        print(f'  Running: {fn} ... ', end='', flush=True)
        code, stdout, stderr = run_file(path)

        if code == 0:
            mark_done(fn)
            print('OK')
        else:
            # Extract the key error line
            err_lines = [l for l in stderr.splitlines() if 'ERROR' in l or 'error' in l.lower()]
            short_err = err_lines[0] if err_lines else stderr[:200]
            print(f'FAILED: {short_err}')
            errors.append((fn, short_err))
            # Continue to next file — don't stop on error

    print(f'\n{"="*60}')
    print(f'Done. {len(files) - len(done) - len(errors)} succeeded, {len(errors)} failed.')
    if errors:
        print('\nFailed migrations:')
        for fn, err in errors:
            print(f'  {fn}: {err}')
        sys.exit(1)
    else:
        print('All migrations applied successfully!')

if __name__ == '__main__':
    main()
