/**
 * Conversion Database Module
 *
 * Tracks conversion status using SQLite to detect partial/interrupted conversions.
 * Replaces size-based validation with definitive status tracking.
 */

import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

// ============================================================================
// Types
// ============================================================================

/** Status of a conversion in the database */
export type ConversionStatus = 'processing' | 'complete' | 'failed';

/** A conversion record from the database */
export interface ConversionRecord {
  id: number;
  video_path: string;
  mp3_path: string;
  status: ConversionStatus;
  started_at: number;
  completed_at: number | null;
  error: string | null;
  video_size: number | null;
  mp3_size: number | null;
}

/** Database file name */
const DB_FILENAME = '.ffmpeg-processor.db';

// ============================================================================
// ConversionDB Class
// ============================================================================

/**
 * SQLite database for tracking conversion status.
 *
 * Usage:
 * 1. Create instance with input directory path
 * 2. Call startConversion() when FFmpeg begins
 * 3. Call completeConversion() or failConversion() when done
 * 4. Query with getStatus(), getIncomplete(), getFailed()
 * 5. Call close() when done
 */
export class ConversionDB {
  private db: Database;
  private dbPath: string;

  // Prepared statements for performance
  private stmtInsert: ReturnType<Database['prepare']>;
  private stmtUpdateComplete: ReturnType<Database['prepare']>;
  private stmtUpdateFailed: ReturnType<Database['prepare']>;
  private stmtGetByPath: ReturnType<Database['prepare']>;
  private stmtGetIncomplete: ReturnType<Database['prepare']>;
  private stmtGetFailed: ReturnType<Database['prepare']>;
  private stmtDelete: ReturnType<Database['prepare']>;

  /**
   * Create or open a conversion database in the specified directory.
   *
   * @param inputDir - Directory where .ffmpeg-processor.db will be created
   */
  constructor(inputDir: string) {
    this.dbPath = join(inputDir, DB_FILENAME);
    this.db = new Database(this.dbPath);

    // Enable WAL mode for better concurrent performance
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');

    // Create schema if needed
    this.initSchema();

    // Prepare statements
    this.stmtInsert = this.db.prepare(`
      INSERT OR REPLACE INTO conversions
      (video_path, mp3_path, status, started_at, completed_at, error, video_size, mp3_size)
      VALUES (?, ?, 'processing', ?, NULL, NULL, ?, NULL)
    `);

    this.stmtUpdateComplete = this.db.prepare(`
      UPDATE conversions
      SET status = 'complete', completed_at = ?, mp3_size = ?
      WHERE video_path = ?
    `);

    this.stmtUpdateFailed = this.db.prepare(`
      UPDATE conversions
      SET status = 'failed', completed_at = ?, error = ?
      WHERE video_path = ?
    `);

    this.stmtGetByPath = this.db.prepare(`
      SELECT * FROM conversions WHERE video_path = ?
    `);

    this.stmtGetIncomplete = this.db.prepare(`
      SELECT * FROM conversions WHERE status = 'processing'
    `);

    this.stmtGetFailed = this.db.prepare(`
      SELECT * FROM conversions WHERE status = 'failed'
    `);

    this.stmtDelete = this.db.prepare(`
      DELETE FROM conversions WHERE video_path = ?
    `);
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_path TEXT NOT NULL UNIQUE,
        mp3_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'processing',
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        error TEXT,
        video_size INTEGER,
        mp3_size INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_status ON conversions(status);
      CREATE INDEX IF NOT EXISTS idx_video_path ON conversions(video_path);
    `);
  }

  /**
   * Record the start of a conversion.
   * Creates or updates the record with status 'processing'.
   *
   * @param videoPath - Full path to the source video file
   * @param mp3Path - Full path to the target MP3 file
   * @param videoSize - Size of the video file in bytes (optional)
   */
  startConversion(videoPath: string, mp3Path: string, videoSize?: number): void {
    this.stmtInsert.run(videoPath, mp3Path, Date.now(), videoSize ?? null);
  }

  /**
   * Record successful completion of a conversion.
   *
   * @param videoPath - Full path to the source video file
   * @param mp3Size - Size of the output MP3 file in bytes
   */
  completeConversion(videoPath: string, mp3Size: number): void {
    this.stmtUpdateComplete.run(Date.now(), mp3Size, videoPath);
  }

  /**
   * Record failed conversion.
   *
   * @param videoPath - Full path to the source video file
   * @param error - Error message describing the failure
   */
  failConversion(videoPath: string, error: string): void {
    this.stmtUpdateFailed.run(Date.now(), error, videoPath);
  }

  /**
   * Get the conversion record for a video file.
   *
   * @param videoPath - Full path to the video file
   * @returns The conversion record, or null if not found
   */
  getStatus(videoPath: string): ConversionRecord | null {
    return this.stmtGetByPath.get(videoPath) as ConversionRecord | null;
  }

  /**
   * Get all incomplete (interrupted) conversions.
   * These have status 'processing' - meaning they were started but never completed.
   *
   * @returns Array of incomplete conversion records
   */
  getIncomplete(): ConversionRecord[] {
    return this.stmtGetIncomplete.all() as ConversionRecord[];
  }

  /**
   * Get all failed conversions.
   *
   * @returns Array of failed conversion records
   */
  getFailed(): ConversionRecord[] {
    return this.stmtGetFailed.all() as ConversionRecord[];
  }

  /**
   * Delete a conversion record.
   * Use this to allow reconversion of a file.
   *
   * @param videoPath - Full path to the video file
   */
  deleteRecord(videoPath: string): void {
    this.stmtDelete.run(videoPath);
  }

  /**
   * Get the path to the database file.
   */
  getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Close the database connection.
   * Call this when done with the database.
   */
  close(): void {
    this.db.close();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Open or create a conversion database for the given input directory.
 *
 * @param inputDir - Directory where the database will be stored
 * @returns ConversionDB instance
 */
export function openConversionDB(inputDir: string): ConversionDB {
  return new ConversionDB(inputDir);
}

/**
 * Check if a conversion database exists in the given directory.
 *
 * @param inputDir - Directory to check
 * @returns true if database exists
 */
export function conversionDBExists(inputDir: string): boolean {
  return existsSync(join(inputDir, DB_FILENAME));
}
