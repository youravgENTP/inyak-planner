import type {
  GeneralEducation,
  GeneralEducationArea,
  GeneralEducationRequirement,
} from '../../domain/general-education/types'
import './GeneralEducationRequirements.css'

interface GeneralEducationRequirementsProps {
  generalEducation: GeneralEducation
}

function formatCredits(
  credits: number | null,
): string {
  if (credits === null) {
    return '개별 최소학점 없음'
  }

  return `${credits}학점`
}

function createRequirementCondition(
  requirement:
    GeneralEducationRequirement,
): string {
  const conditions = [
    `최소 ${requirement.minimumCredits}학점`,
  ]

  if (
    requirement.minimumAreaCount !== null
  ) {
    conditions.push(
      `${requirement.minimumAreaCount}개 영역 이상`,
    )
  }

  return conditions.join(' · ')
}

function GeneralEducationAreaItem({
  area,
}: {
  area: GeneralEducationArea
}) {
  return (
    <li className="general-education-area-item">
      <div className="general-education-area-heading">
        <strong>{area.areaName}</strong>

        <span>
          {formatCredits(
            area.minimumCredits,
          )}
        </span>
      </div>

      <div className="general-education-area-meta">
        <span>
          {area.isRequired
            ? '필수 영역'
            : '선택 영역'}
        </span>
      </div>

      {area.notes !== null && (
        <p className="general-education-area-notes">
          {area.notes}
        </p>
      )}
    </li>
  )
}

function GeneralEducationRequirementCard({
  requirement,
}: {
  requirement:
    GeneralEducationRequirement
}) {
  return (
    <article className="general-education-card">
      <header className="general-education-card-header">
        <div>
          <span>교양 이수구분</span>

          <h2>{requirement.category}</h2>
        </div>

        <strong>
          {requirement.areas.length}
          개 영역
        </strong>
      </header>

      <div className="general-education-condition">
        <span>이수요건</span>

        <strong>
          {createRequirementCondition(
            requirement,
          )}
        </strong>
      </div>

      {requirement.notes !== null && (
        <p className="general-education-requirement-notes">
          {requirement.notes}
        </p>
      )}

      <ul className="general-education-area-list">
        {requirement.areas.map((area) => (
          <GeneralEducationAreaItem
            area={area}
            key={area.id}
          />
        ))}
      </ul>
    </article>
  )
}

export function GeneralEducationRequirements({
  generalEducation,
}: GeneralEducationRequirementsProps) {
  if (
    generalEducation.requirements.length ===
    0
  ) {
    return (
      <div className="general-education-empty">
        <h2>
          등록된 교양 졸업요건이 없습니다.
        </h2>

        <p>
          선택한 학번의 교양요건 데이터를
          확인해 주세요.
        </p>
      </div>
    )
  }

  const totalMinimumCredits =
    generalEducation.requirements.reduce(
      (total, requirement) =>
        total +
        requirement.minimumCredits,
      0,
    )

  return (
    <div className="general-education">
      <div className="general-education-overview">
        <div className="general-education-overview-item">
          <span>교양 이수구분</span>

          <strong>
            {generalEducation.count}개
          </strong>
        </div>

        <div className="general-education-overview-item">
          <span>최소 교양학점</span>

          <strong>
            {totalMinimumCredits}학점
          </strong>
        </div>

        <div className="general-education-overview-item">
          <span>기준 학번</span>

          <strong>
            {generalEducation.entryYear}학번
          </strong>
        </div>
      </div>

      <div className="general-education-card-list">
        {generalEducation.requirements.map(
          (requirement) => (
            <GeneralEducationRequirementCard
              key={requirement.id}
              requirement={requirement}
            />
          ),
        )}
      </div>
    </div>
  )
}