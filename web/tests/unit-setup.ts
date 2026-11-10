// Before every unit test: write dates as a British device does (decision 0232),
// so the tests read the same on any computer. src/lib/times.test.ts tries others.
import { writeDatesLike } from "../src/lib/times";

writeDatesLike("en-GB");
