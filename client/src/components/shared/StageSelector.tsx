import React from 'react';
import type { StageConfigData, GradeConfigData } from '../../api/settings';

// Exact stage/grade mappings from the original system
const STAGE_LABELS: Record<string, string> = {
  Kindergarten: 'رياض الأطفال',
  Primary: 'المرحلة الابتدائية',
  Intermediate: 'المرحلة المتوسطة',
  Secondary: 'المرحلة الثانوية',
};

const GRADE_NAMES: Record<string, string[]> = {
  Kindergarten: ['تمهيدي', 'KG1', 'KG2', 'KG3'],
  Primary: ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'],
  Intermediate: ['الأول', 'الثاني', 'الثالث'],
  Secondary: ['الأول', 'الثاني', 'الثالث'],
};

interface Props {
  stages: StageConfigData[];
  onChange: (stages: StageConfigData[]) => void;
  schoolType: string;
}

const StageSelector: React.FC<Props> = ({ stages, onChange, schoolType }) => {
  const toggleStage = (stageKey: string) => {
    const updated = stages.map((s) =>
      s.stage === stageKey ? { ...s, isEnabled: !s.isEnabled } : s
    );
    onChange(updated);
  };

  const toggleGrade = (stageKey: string, gradeName: string) => {
    const updated = stages.map((s) => {
      if (s.stage !== stageKey) return s;
      return {
        ...s,
        grades: s.grades.map((g) =>
          g.gradeName === gradeName ? { ...g, isEnabled: !g.isEnabled } : g
        ),
      };
    });
    onChange(updated);
  };

  const setClassCount = (stageKey: string, gradeName: string, count: number) => {
    const updated = stages.map((s) => {
      if (s.stage !== stageKey) return s;
      return {
        ...s,
        grades: s.grades.map((g) =>
          g.gradeName === gradeName ? { ...g, classCount: Math.max(0, count) } : g
        ),
      };
    });
    onChange(updated);
  };

  return (
    <div className="stage-selector">
      {stages.map((stage) => (
        <div key={stage.stage} className="stage-card" style={{
          border: '2px solid #e8ebf2',
          borderRadius: '12px',
          marginBottom: '16px',
          overflow: 'hidden',
        }}>
          {/* Stage header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              background: stage.isEnabled ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : '#f5f5f5',
              color: stage.isEnabled ? '#fff' : '#666',
              cursor: 'pointer',
            }}
            onClick={() => toggleStage(stage.stage)}
          >
            <input
              type="checkbox"
              checked={stage.isEnabled}
              onChange={() => toggleStage(stage.stage)}
              style={{ marginLeft: '8px' }}
            />
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
              {STAGE_LABELS[stage.stage] || stage.stage}
            </span>
          </div>

          {/* Grades */}
          {stage.isEnabled && (
            <div style={{ padding: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <th style={{ textAlign: 'right', padding: '8px' }}>تفعيل</th>
                    <th style={{ textAlign: 'right', padding: '8px' }}>الصف</th>
                    <th style={{ textAlign: 'right', padding: '8px' }}>عدد الفصول</th>
                  </tr>
                </thead>
                <tbody>
                  {stage.grades.map((grade) => (
                    <tr key={grade.gradeName} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="checkbox"
                          checked={grade.isEnabled}
                          onChange={() => toggleGrade(stage.stage, grade.gradeName)}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>{grade.gradeName}</td>
                      <td style={{ padding: '8px' }}>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={grade.classCount}
                          onChange={(e) =>
                            setClassCount(stage.stage, grade.gradeName, parseInt(e.target.value) || 0)
                          }
                          disabled={!grade.isEnabled}
                          style={{
                            width: '60px',
                            padding: '4px 8px',
                            border: '2px solid #e8ebf2',
                            borderRadius: '8px',
                            textAlign: 'center',
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Helper to build initial stage configs
export function buildInitialStages(): StageConfigData[] {
  return Object.entries(GRADE_NAMES).map(([stage, gradeNames]) => ({
    stage,
    isEnabled: false,
    grades: gradeNames.map((name) => ({
      gradeName: name,
      classCount: 0,
      isEnabled: false,
    })),
  }));
}

export default StageSelector;
