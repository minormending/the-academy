// Runs before every test file: keep the output of expected warnings (duplicate registrations etc.) quiet
// but never swallow errors.
import { vi } from 'vitest';

vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});
