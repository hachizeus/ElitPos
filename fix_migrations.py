"""
Fix all migration SQL files to be idempotent:
- ADD COLUMN IF NOT EXISTS
- DROP COLUMN IF EXISTS
- Wrap ADD CONSTRAINT in DO $$ BEGIN / EXCEPTION blocks
- Fix any mangled $$ sequences
"""
import os
import re

DRIZZLE_DIR = os.path.join(os.path.dirname(__file__), 'drizzle')

def fix_file(path):
    with open(path, encoding='utf-8') as f:
        original = f.read()

    text = original

    # Fix any mangled dollar-sign sequences from previous bad runs
    text = text.replace('\\$', '$')
    text = re.sub(r'\bDO Length BEGIN\b', 'DO $$ BEGIN', text)
    text = re.sub(r'\bEND Length;', 'END $$;', text)
    text = re.sub(r'\bEND Length\b', 'END $$', text)

    # Wrap bare CREATE TYPE in DO blocks (not already inside a DO block)
    lines2 = text.split('\n')
    out2 = []
    in_do2 = 0
    for line in lines2:
        if re.search(r'\bDO\s+\$\$', line): in_do2 += 1
        if re.search(r'\bEND\s+\$\$', line) and in_do2 > 0:
            in_do2 -= 1
            out2.append(line)
            continue
        if in_do2 == 0 and re.match(r'\s*CREATE TYPE .+ AS ENUM.+;', line):
            has_marker = '--> statement-breakpoint' in line
            stmt = line.replace('--> statement-breakpoint', '').strip()
            out2.append('DO $$ BEGIN')
            out2.append('  ' + stmt)
            out2.append('EXCEPTION WHEN duplicate_object THEN NULL;')
            out2.append('END $$;' + ('--> statement-breakpoint' if has_marker else ''))
        else:
            out2.append(line)
    text = '\n'.join(out2)

    # Add IF NOT EXISTS to all bare CREATE TABLE / CREATE INDEX
    text = re.sub(r'CREATE TABLE (?!IF NOT EXISTS)', 'CREATE TABLE IF NOT EXISTS ', text)
    text = re.sub(r'CREATE UNIQUE INDEX (?!IF NOT EXISTS)', 'CREATE UNIQUE INDEX IF NOT EXISTS ', text)
    text = re.sub(r'CREATE INDEX (?!IF NOT EXISTS)', 'CREATE INDEX IF NOT EXISTS ', text)

    # Add IF NOT EXISTS to ALTER TYPE ADD VALUE statements (without AFTER clause conflict)
    text = re.sub(
        r"ALTER TYPE ([^\n]+) ADD VALUE '([^']+)'",
        lambda m: f"ALTER TYPE {m.group(1)} ADD VALUE IF NOT EXISTS '{m.group(2)}'",
        text
    )

    # Fix doubled IF NOT EXISTS / IF EXISTS
    text = re.sub(r'ADD COLUMN (IF NOT EXISTS\s+)+', 'ADD COLUMN IF NOT EXISTS ', text)
    text = re.sub(r'DROP COLUMN (IF EXISTS\s+)+', 'DROP COLUMN IF EXISTS ', text)

    # Ensure ADD COLUMN always has IF NOT EXISTS
    text = re.sub(r'ADD COLUMN (?!IF NOT EXISTS)', 'ADD COLUMN IF NOT EXISTS ', text)

    # Ensure DROP COLUMN always has IF EXISTS
    text = re.sub(r'DROP COLUMN (?!IF EXISTS)', 'DROP COLUMN IF EXISTS ', text)

    # Wrap bare CREATE POLICY in DO blocks (idempotent)
    lines_p = text.split('\n')
    out_p = []
    in_do_p = 0
    i = 0
    while i < len(lines_p):
        line = lines_p[i]
        if re.search(r'\bDO\s+\$\$', line): in_do_p += 1
        if re.search(r'\bEND\s+\$\$', line) and in_do_p > 0:
            in_do_p -= 1
            out_p.append(line)
            i += 1
            continue
        if in_do_p == 0 and re.match(r'\s*CREATE POLICY\s+', line):
            stmt_lines = [line]
            while not stmt_lines[-1].rstrip().rstrip('--> statement-breakpoint').rstrip().endswith(';'):
                i += 1
                if i < len(lines_p):
                    stmt_lines.append(lines_p[i])
                else:
                    break
            full_stmt = '\n'.join(stmt_lines)
            has_marker = '--> statement-breakpoint' in full_stmt
            clean_stmt = full_stmt.replace('--> statement-breakpoint', '').rstrip()
            out_p.append('DO $$ BEGIN')
            for sl in clean_stmt.split('\n'):
                out_p.append('  ' + sl)
            out_p.append('EXCEPTION WHEN duplicate_object THEN NULL;')
            out_p.append('END $$;' + ('--> statement-breakpoint' if has_marker else ''))
        else:
            out_p.append(line)
        i += 1
    text = '\n'.join(out_p)

    # Wrap bare ADD CONSTRAINT in DO blocks
    lines = text.split('\n')
    out = []
    in_do = 0
    for line in lines:
        if re.search(r'\bDO\s+\$\$', line):
            in_do += 1
        if re.search(r'\bEND\s+\$\$', line) and in_do > 0:
            in_do -= 1
            out.append(line)
            continue

        if in_do == 0 and re.match(r'\s*ALTER TABLE .+ ADD CONSTRAINT .+;', line):
            has_marker = '--> statement-breakpoint' in line
            stmt = line.replace('--> statement-breakpoint', '').strip()
            out.append('DO $$ BEGIN')
            out.append('  ' + stmt)
            out.append('EXCEPTION WHEN duplicate_object THEN NULL;')
            out.append('END $$;' + ('--> statement-breakpoint' if has_marker else ''))
        else:
            out.append(line)

    text = '\n'.join(out)

    if text != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        return True
    return False


def main():
    files = sorted(f for f in os.listdir(DRIZZLE_DIR) if f.endswith('.sql'))
    fixed = 0
    for fn in files:
        path = os.path.join(DRIZZLE_DIR, fn)
        if fix_file(path):
            print(f'Fixed: {fn}')
            fixed += 1
    print(f'\nDone — {fixed}/{len(files)} files updated')


if __name__ == '__main__':
    main()
