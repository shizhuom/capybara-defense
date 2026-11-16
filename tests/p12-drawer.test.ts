import {expect,it,vi} from 'vitest';
import {GameApp} from '../src/ui/GameApp';
it('opens and closes only the result drawer, restoring its launch button focus',()=>{
 const app:any=Object.create(GameApp.prototype),focus=vi.fn();
 Object.assign(app,{dialogKind:'result',resultStatsOpen:false,sound:{play(){}},profileScreens:{action:()=>false},meta:{action:()=>false},renderDialog:vi.fn(),dialog:{querySelector:vi.fn(()=>({focus}))}});
 app.action('toggle-result-stats');expect(app.resultStatsOpen).toBe(true);expect(app.renderDialog).toHaveBeenCalledOnce();
 expect(app.dialog.querySelector).toHaveBeenLastCalledWith('[data-action="close-result-stats"]');expect(focus).toHaveBeenCalled();
 app.action('close-result-stats');expect(app.resultStatsOpen).toBe(false);
 expect(app.dialog.querySelector).toHaveBeenLastCalledWith('.btn-stats');
});
